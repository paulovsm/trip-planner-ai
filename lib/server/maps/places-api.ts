import { DomainError } from "@/lib/domain/errors"
import type { PlaceCategory } from "@/lib/domain/categories"
import { categoryFromGoogleTypes, cityFromAddressComponents } from "@/lib/domain/google-types"

// Places API (New) Text Search, server-side (same server key as the Routes API).
// Used to resolve imported places and by the assistant's searchPlaces tool.

export type FoundPlace = {
  googlePlaceId: string
  name: string
  address?: string
  city?: string
  category: PlaceCategory
  location: { lat: number; lng: number }
  rating?: number
}

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText"
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
  "places.addressComponents",
  "places.rating",
].join(",")

type RawPlace = {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  location?: { latitude?: number; longitude?: number }
  types?: string[]
  addressComponents?: { longText?: string; types?: string[] }[]
  rating?: number
}

export function parsePlaces(body: { places?: RawPlace[] }): FoundPlace[] {
  return (body.places ?? []).flatMap((p) => {
    if (!p.id || !p.displayName?.text || p.location?.latitude === undefined || p.location.longitude === undefined) return []
    return [
      {
        googlePlaceId: p.id,
        name: p.displayName.text,
        address: p.formattedAddress,
        city: cityFromAddressComponents(p.addressComponents),
        category: categoryFromGoogleTypes(p.types),
        location: { lat: p.location.latitude, lng: p.location.longitude },
        rating: p.rating,
      },
    ]
  })
}

/** Deterministic fake results (MAPS_FAKE=1): a point near `bias` (or Lisbon) derived from the query. */
export function fakePlaces(query: string, bias?: { lat: number; lng: number }, max = 3): FoundPlace[] {
  let h = 0
  for (const c of query) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const base = bias ?? { lat: 38.7223, lng: -9.1393 }
  return Array.from({ length: max }, (_, i) => ({
    googlePlaceId: `fake-${h.toString(36)}-${i}`,
    name: i === 0 ? query.split(",")[0].trim() : `${query.split(",")[0].trim()} (${i + 1})`,
    address: `Endereço de teste ${i + 1}`,
    city: query.split(",")[1]?.trim() || undefined,
    category: "turismo" as const,
    location: { lat: base.lat + (((h >> (i * 3)) % 200) - 100) / 10_000, lng: base.lng + (((h >> (i * 5)) % 200) - 100) / 10_000 },
  }))
}

export async function searchText(
  query: string,
  { bias, max = 5, fetchImpl = fetch }: { bias?: { lat: number; lng: number }; max?: number; fetchImpl?: typeof fetch } = {},
): Promise<FoundPlace[]> {
  if (process.env.MAPS_FAKE === "1") return fakePlaces(query, bias, Math.min(max, 3))
  const key = process.env.GOOGLE_MAPS_SERVER_KEY
  if (!key) throw new DomainError("UPSTREAM", "Busca de lugares indisponível: configure GOOGLE_MAPS_SERVER_KEY no servidor.")
  let res: Response
  try {
    res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELD_MASK },
      body: JSON.stringify({
        textQuery: query,
        languageCode: "pt-BR",
        maxResultCount: max,
        ...(bias ? { locationBias: { circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: 50_000 } } } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new DomainError("UPSTREAM", "A busca de lugares do Google não respondeu.")
  }
  if (res.status === 401 || res.status === 403) {
    console.error("[places] auth error", res.status, await res.text().catch(() => ""))
    throw new DomainError("UPSTREAM", "A chave do Google Maps do servidor não tem acesso à Places API (New).")
  }
  if (!res.ok) throw new DomainError("UPSTREAM", "A busca de lugares do Google falhou.")
  return parsePlaces(await res.json())
}

/** Resolves many names with bounded concurrency (imports). Failures resolve to null. */
export async function resolveMany<T>(
  items: T[],
  query: (item: T) => string,
  opts: { bias?: { lat: number; lng: number }; concurrency?: number } = {},
): Promise<(FoundPlace | null)[]> {
  const out: (FoundPlace | null)[] = new Array(items.length).fill(null)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      try {
        out[i] = (await searchText(query(items[i]), { bias: opts.bias, max: 1 }))[0] ?? null
      } catch (err) {
        if (err instanceof DomainError && /configure|acesso/.test(err.message)) throw err
        out[i] = null
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? 4, items.length) }, worker))
  return out
}
