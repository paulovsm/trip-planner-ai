import { decode, encode } from "@googlemaps/polyline-codec"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { buildRequest, computeRoute, mergeLegs, parseDuration, parseResponse } from "./routes-api"

const A = { lat: 38.6916, lng: -9.216 }
const B = { lat: 38.6979, lng: -9.2068 }
const C = { lat: 38.7036, lng: -9.1784 }

const fixture = (pts: { lat: number; lng: number }[], legs: [number, string][], extra = {}) => ({
  routes: [
    {
      distanceMeters: legs.reduce((s, [d]) => s + d, 0),
      duration: `${legs.reduce((s, [, t]) => s + parseDuration(t), 0)}s`,
      polyline: { encodedPolyline: encode(pts, 5) },
      legs: legs.map(([distanceMeters, duration]) => ({ distanceMeters, duration })),
      ...extra,
    },
  ],
})

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

describe("request/response mapping", () => {
  it("builds a computeRoutes request", () => {
    const req = buildRequest([A, B, C], "WALK", true)
    expect(req.origin.location.latLng).toEqual({ latitude: A.lat, longitude: A.lng })
    expect(req.intermediates).toHaveLength(1)
    expect(req).toMatchObject({ travelMode: "WALK", optimizeWaypointOrder: true, polylineQuality: "HIGH_QUALITY" })
    expect(buildRequest([A, C], "DRIVE")).toMatchObject({ routingPreference: "TRAFFIC_UNAWARE" })
  })

  it("parses durations, legs and optimized order", () => {
    const r = parseResponse(fixture([A, B, C], [[1050, "780s"], [2600, "2100.5s"]], { optimizedIntermediateWaypointIndex: [0] }))
    expect(r.durationSec).toBeCloseTo(2880.5)
    expect(r.legs).toEqual([
      { distanceMeters: 1050, durationSec: 780 },
      { distanceMeters: 2600, durationSec: 2100.5 },
    ])
    expect(r.optimizedIntermediateOrder).toEqual([0])
  })

  it("merges per-leg transit routes without duplicating joints", () => {
    const merged = mergeLegs([parseResponse(fixture([A, B], [[1000, "600s"]])), parseResponse(fixture([B, C], [[2000, "900s"]]))])
    expect(decode(merged.encodedPolyline, 5)).toHaveLength(3)
    expect(merged.legs).toEqual([
      { distanceMeters: 1000, durationSec: 600 },
      { distanceMeters: 2000, durationSec: 900 },
    ])
    expect(merged.durationSec).toBe(1500)
  })
})

describe("computeRoute", () => {
  beforeEach(() => vi.stubEnv("GOOGLE_MAPS_SERVER_KEY", "test-key"))
  afterEach(() => vi.unstubAllEnvs())

  it("sends the key and field mask, one request for walking", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(fixture([A, B, C], [[1, "1s"], [1, "1s"]])))
    await computeRoute([A, B, C], "WALK", { fetchImpl })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers["X-Goog-Api-Key"]).toBe("test-key")
    expect(headers["X-Goog-FieldMask"]).toContain("routes.polyline.encodedPolyline")
  })

  it("computes transit leg by leg", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(fixture([A, B], [[1, "60s"]])))
    const r = await computeRoute([A, B, C], "TRANSIT", { fetchImpl })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(r.legs).toHaveLength(2)
  })

  it("maps errors to friendly messages", async () => {
    await expect(computeRoute([A, B], "BICYCLE", { fetchImpl: async () => jsonResponse({}, 400) })).rejects.toThrow(
      /de bicicleta/,
    )
    await expect(computeRoute([A, B], "WALK", { fetchImpl: async () => jsonResponse({ routes: [] }) })).rejects.toMatchObject({
      code: "VALIDATION",
    })
    await expect(computeRoute([A, B], "WALK", { fetchImpl: async () => jsonResponse({}, 403) })).rejects.toMatchObject({
      code: "UPSTREAM",
    })
    await expect(
      computeRoute([A, B], "WALK", {
        fetchImpl: async () => {
          throw new TypeError("network")
        },
      }),
    ).rejects.toMatchObject({ code: "UPSTREAM" })
  })

  it("requires the server key", async () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_KEY", "")
    await expect(computeRoute([A, B], "WALK", { fetchImpl: vi.fn() })).rejects.toThrow(/GOOGLE_MAPS_SERVER_KEY/)
  })
})
