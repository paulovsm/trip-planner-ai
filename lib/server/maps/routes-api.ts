import { decode, encode } from "@googlemaps/polyline-codec"
import { DomainError } from "@/lib/domain/errors"
import type { TravelMode } from "@/lib/domain/schemas"

// Google Routes API (computeRoutes). Pure request/response mapping lives here so it
// can be unit-tested with fixtures; the network call is in computeRoute().

export type LatLng = { lat: number; lng: number }

export type ComputedRoute = {
  encodedPolyline: string
  distanceMeters: number
  durationSec: number
  legs: { distanceMeters: number; durationSec: number }[]
  /** Order of the intermediates when optimizeWaypointOrder was requested. */
  optimizedIntermediateOrder?: number[]
  warnings?: string[]
}

const ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes"
const FIELD_MASK = [
  "routes.distanceMeters",
  "routes.duration",
  "routes.polyline.encodedPolyline",
  "routes.legs.distanceMeters",
  "routes.legs.duration",
  "routes.optimizedIntermediateWaypointIndex",
  "routes.warnings",
].join(",")

const waypoint = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } })

export function buildRequest(points: LatLng[], mode: TravelMode, optimize = false) {
  return {
    origin: waypoint(points[0]),
    destination: waypoint(points[points.length - 1]),
    intermediates: points.slice(1, -1).map(waypoint),
    travelMode: mode,
    polylineQuality: "HIGH_QUALITY",
    languageCode: "pt-BR",
    units: "METRIC",
    ...(mode === "DRIVE" ? { routingPreference: "TRAFFIC_UNAWARE" } : {}),
    ...(optimize ? { optimizeWaypointOrder: true } : {}),
  }
}

/** "1234s" → 1234 */
export const parseDuration = (d: string | undefined) => (d ? Number.parseFloat(d.replace(/s$/, "")) || 0 : 0)

type RawRoute = {
  distanceMeters?: number
  duration?: string
  polyline?: { encodedPolyline?: string }
  legs?: { distanceMeters?: number; duration?: string }[]
  optimizedIntermediateWaypointIndex?: number[]
  warnings?: string[]
}

export function parseResponse(body: { routes?: RawRoute[] }): ComputedRoute {
  const r = body.routes?.[0]
  if (!r?.polyline?.encodedPolyline) throw noRoute()
  return {
    encodedPolyline: r.polyline.encodedPolyline,
    distanceMeters: r.distanceMeters ?? 0,
    durationSec: parseDuration(r.duration),
    legs: (r.legs ?? []).map((l) => ({ distanceMeters: l.distanceMeters ?? 0, durationSec: parseDuration(l.duration) })),
    optimizedIntermediateOrder: r.optimizedIntermediateWaypointIndex?.filter((i) => i >= 0),
    warnings: r.warnings?.length ? r.warnings : undefined,
  }
}

/** Joins per-leg routes (TRANSIT does not accept intermediates) into one Route. */
export function mergeLegs(parts: ComputedRoute[]): ComputedRoute {
  const path = parts.flatMap((p, i) => {
    const pts = decode(p.encodedPolyline, 5)
    return i === 0 ? pts : pts.slice(1) // drop the duplicated joint
  })
  const warnings = [...new Set(parts.flatMap((p) => p.warnings ?? []))]
  return {
    encodedPolyline: encode(path, 5),
    distanceMeters: parts.reduce((s, p) => s + p.distanceMeters, 0),
    durationSec: parts.reduce((s, p) => s + p.durationSec, 0),
    legs: parts.map((p) => ({ distanceMeters: p.distanceMeters, durationSec: p.durationSec })),
    warnings: warnings.length ? warnings : undefined,
  }
}

const MODE_NAME: Record<TravelMode, string> = { WALK: "a pé", BICYCLE: "de bicicleta", DRIVE: "de carro", TRANSIT: "de transporte público" }
const noRoute = (mode?: TravelMode) =>
  new DomainError(
    "VALIDATION",
    mode ? `Não há percurso ${MODE_NAME[mode]} entre essas paradas.` : "Não foi possível calcular o percurso entre essas paradas.",
  )

async function call(points: LatLng[], mode: TravelMode, optimize: boolean, fetchImpl: typeof fetch): Promise<ComputedRoute> {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY
  if (!key) throw new DomainError("UPSTREAM", "Cálculo de percurso indisponível: configure GOOGLE_MAPS_SERVER_KEY no servidor.")
  let res: Response
  try {
    res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELD_MASK },
      body: JSON.stringify(buildRequest(points, mode, optimize)),
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new DomainError("UPSTREAM", "O serviço de percursos do Google não respondeu. Tente novamente.")
  }
  if (res.status === 400 || res.status === 404) throw noRoute(mode)
  if (res.status === 403 || res.status === 401) {
    console.error("[routes] auth error", res.status, await res.text().catch(() => ""))
    throw new DomainError("UPSTREAM", "A chave do Google Maps do servidor não tem acesso à Routes API.")
  }
  if (!res.ok) throw new DomainError("UPSTREAM", "O serviço de percursos do Google falhou. Tente novamente.")
  const body = await res.json()
  if (!body.routes?.length) throw noRoute(mode)
  return parseResponse(body)
}

/**
 * Computes the Route through `points` in order. With `optimize`, Google may reorder
 * the intermediates (origin and destination stay fixed).
 */
export async function computeRoute(
  points: LatLng[],
  mode: TravelMode,
  { optimize = false, fetchImpl = fetch }: { optimize?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<ComputedRoute> {
  if (points.length < 2) throw new DomainError("VALIDATION", "O percurso precisa de pelo menos 2 paradas.")
  if (process.env.MAPS_FAKE === "1") return fakeRoute(points, mode, optimize)
  if (mode !== "TRANSIT" || points.length === 2) return call(points, mode, optimize, fetchImpl)
  const legs = await Promise.all(points.slice(1).map((p, i) => call([points[i], p], mode, false, fetchImpl)))
  return mergeLegs(legs)
}

// ---------- Fake mode (tests / local dev without a server key) ----------

const SPEED_MS: Record<TravelMode, number> = { WALK: 1.3, BICYCLE: 4.2, DRIVE: 8.3, TRANSIT: 6 }

function haversine(a: LatLng, b: LatLng) {
  const r = (d: number) => (d * Math.PI) / 180
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2
  return 2 * 6_371_008.8 * Math.asin(Math.sqrt(h))
}

/** Deterministic straight-line Route; "optimizes" by reversing the intermediates. */
export function fakeRoute(points: LatLng[], mode: TravelMode, optimize = false): ComputedRoute {
  const middle = points.slice(1, -1).map((_, i) => i)
  const order = optimize ? [...middle].reverse() : middle
  const ordered = [points[0], ...order.map((i) => points[i + 1]), points[points.length - 1]]
  const legs = ordered.slice(1).map((p, i) => {
    const distanceMeters = Math.round(haversine(ordered[i], p) * 1.25)
    return { distanceMeters, durationSec: Math.round(distanceMeters / SPEED_MS[mode]) }
  })
  return {
    encodedPolyline: encode(ordered.map((p) => [p.lat, p.lng] as [number, number]), 5),
    distanceMeters: legs.reduce((s, l) => s + l.distanceMeters, 0),
    durationSec: legs.reduce((s, l) => s + l.durationSec, 0),
    legs,
    optimizedIntermediateOrder: optimize ? order : undefined,
  }
}
