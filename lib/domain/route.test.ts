import { describe, expect, it } from "vitest"
import { canOptimize, computeEtas, formatDistance, formatDuration, isRouteStale } from "./route"
import type { Day, Route } from "./schemas"

const stops = (n: number, extra: Partial<Day["stops"][number]>[] = []) =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, placeId: `p${i}`, ...extra[i] }))

const route = (keys: string, legs: number[], mode: Route["travelMode"] = "WALK"): Route => ({
  travelMode: mode,
  stopIdsKey: keys,
  encodedPolyline: "abc",
  distanceMeters: 1000,
  durationSec: legs.reduce((a, b) => a + b, 0),
  legs: legs.map((d) => ({ distanceMeters: 100, durationSec: d })),
  computedAt: "2026-11-15T00:00:00.000Z",
})

describe("isRouteStale", () => {
  it("is stale without a route, after reordering, or after a mode change", () => {
    const day = { stops: stops(2), travelMode: "WALK" as const, route: route("s0,s1", [600]) }
    expect(isRouteStale(day)).toBe(false)
    expect(isRouteStale({ ...day, route: null })).toBe(true)
    expect(isRouteStale({ ...day, stops: [...day.stops].reverse() })).toBe(true)
    expect(isRouteStale({ ...day, travelMode: "BICYCLE" })).toBe(true)
  })
})

describe("canOptimize", () => {
  it("needs 3-27 stops and a non-transit mode", () => {
    expect(canOptimize({ stops: stops(3), travelMode: "WALK" }).ok).toBe(true)
    expect(canOptimize({ stops: stops(2), travelMode: "WALK" }).ok).toBe(false)
    expect(canOptimize({ stops: stops(28), travelMode: "WALK" }).ok).toBe(false)
    expect(canOptimize({ stops: stops(5), travelMode: "TRANSIT" }).ok).toBe(false)
  })
})

describe("computeEtas", () => {
  it("chains durations and legs from 09:00 by default", () => {
    const day = {
      stops: stops(3, [{ durationMin: 60 }, { durationMin: 30 }]),
      travelMode: "WALK" as const,
      route: route("s0,s1,s2", [600, 900]),
    }
    expect(computeEtas(day)!.map((e) => e.eta)).toEqual(["09:00", "10:10", "10:55"])
  })

  it("waits for later planned times and flags late arrivals", () => {
    const day = {
      stops: stops(3, [{ time: "08:00", durationMin: 60 }, { time: "11:00" }, { time: "11:05", durationMin: 0 }]),
      travelMode: "WALK" as const,
      route: route("s0,s1,s2", [1200, 1800]),
    }
    const etas = computeEtas(day)!
    expect(etas.map((e) => [e.eta, e.late])).toEqual([
      ["08:00", false],
      ["09:20", false], // arrives early, waits until 11:00
      ["11:30", true], // 11:00 + 30 min leg > planned 11:05
    ])
    expect(etas[1].legBefore).toEqual({ distanceMeters: 100, durationSec: 1200 })
  })

  it("returns null when the route is missing or stale", () => {
    expect(computeEtas({ stops: stops(2), travelMode: "WALK", route: null })).toBeNull()
    expect(computeEtas({ stops: stops(2), travelMode: "WALK", route: route("s1,s0", [60]) })).toBeNull()
  })
})

describe("formatting", () => {
  it("formats distances and durations in pt-BR", () => {
    expect(formatDistance(640)).toBe("640 m")
    expect(formatDistance(4230)).toBe("4,2 km")
    expect(formatDistance(23_400)).toBe("23 km")
    expect(formatDuration(30)).toBe("1 min")
    expect(formatDuration(3540)).toBe("59 min")
    expect(formatDuration(5400)).toBe("1 h 30 min")
    expect(formatDuration(7200)).toBe("2 h")
  })
})
