import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fakePlaces, parsePlaces, resolveMany, searchText } from "./places-api"

const raw = {
  places: [
    {
      id: "ChIJ1",
      displayName: { text: "Torre de Belém" },
      formattedAddress: "Av. Brasília, 1400-038 Lisboa, Portugal",
      location: { latitude: 38.6916, longitude: -9.216 },
      types: ["historical_landmark", "tourist_attraction"],
      addressComponents: [{ longText: "Lisboa", types: ["locality"] }],
      rating: 4.6,
    },
    { id: "broken", displayName: { text: "Sem localização" } },
  ],
}

describe("places-api", () => {
  beforeEach(() => vi.stubEnv("GOOGLE_MAPS_SERVER_KEY", "k"))
  afterEach(() => vi.unstubAllEnvs())

  it("parses results, mapping category and city, skipping incomplete ones", () => {
    expect(parsePlaces(raw)).toEqual([
      {
        googlePlaceId: "ChIJ1",
        name: "Torre de Belém",
        address: "Av. Brasília, 1400-038 Lisboa, Portugal",
        city: "Lisboa",
        category: "historia",
        location: { lat: 38.6916, lng: -9.216 },
        rating: 4.6,
      },
    ])
  })

  it("sends the field mask and location bias", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(raw)))
    await searchText("Torre de Belém", { bias: { lat: 38.7, lng: -9.1 }, fetchImpl })
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect((init.headers as Record<string, string>)["X-Goog-FieldMask"]).toContain("places.location")
    expect(JSON.parse(init.body as string)).toMatchObject({ textQuery: "Torre de Belém", locationBias: { circle: { radius: 50_000 } } })
  })

  it("is deterministic in fake mode", async () => {
    vi.stubEnv("MAPS_FAKE", "1")
    const a = await searchText("Pastéis de Belém, Lisboa")
    expect(a).toEqual(fakePlaces("Pastéis de Belém, Lisboa"))
    expect(a[0]).toMatchObject({ name: "Pastéis de Belém", city: "Lisboa" })
  })

  it("resolves many with failures as null, but surfaces configuration errors", async () => {
    vi.stubEnv("MAPS_FAKE", "1")
    const out = await resolveMany(["A, X", "B, Y"], (s) => s)
    expect(out.map((p) => p?.name)).toEqual(["A", "B"])

    vi.stubEnv("MAPS_FAKE", "")
    vi.stubEnv("GOOGLE_MAPS_SERVER_KEY", "")
    await expect(resolveMany(["A"], (s) => s)).rejects.toThrow(/GOOGLE_MAPS_SERVER_KEY/)
  })
})
