import { describe, expect, it, vi } from "vitest"
import { isRouteStale } from "@/lib/domain/route"
import { addStop, createDay, editStop, reorderStops } from "@/lib/server/commands/days"
import { createPlace } from "@/lib/server/commands/places"
import { computeDayRoute, exportRoute, optimizeDay } from "@/lib/server/commands/routes"
import { createTrip, getTripDetail } from "@/lib/server/commands/trips"
import { alice, belem, bob, expectCode, jeronimos, lxFactory } from "./helpers"

// The Routes API is mocked: optimize reverses the intermediates.
vi.mock("@/lib/server/maps/routes-api", () => ({
  computeRoute: vi.fn(async (points: unknown[], mode: string, opts?: { optimize?: boolean }) => ({
    encodedPolyline: `poly-${mode}-${points.length}`,
    distanceMeters: 1000 * (points.length - 1),
    durationSec: 600 * (points.length - 1),
    legs: points.slice(1).map(() => ({ distanceMeters: 1000, durationSec: 600 })),
    optimizedIntermediateOrder: opts?.optimize ? points.slice(1, -1).map((_, i, a) => a.length - 1 - i) : undefined,
  })),
}))

async function dayWith(n: number) {
  const trip = await createTrip(alice, { name: "Lisboa" })
  const extra = { name: "Time Out Market", category: "gastronomia" as const, location: { lat: 38.707, lng: -9.146 } }
  const places = await Promise.all([belem, jeronimos, lxFactory, extra].slice(0, n).map((p) => createPlace(alice, trip.id, p)))
  let day = await createDay(alice, trip.id, { date: "2026-12-03" })
  for (const p of places) day = await addStop(alice, trip.id, day.id, { placeId: p.id })
  return { trip, day }
}

describe("routes", () => {
  it("computes and stores a fresh Route; edits make it stale", async () => {
    const { trip, day } = await dayWith(3)
    const routed = await computeDayRoute(alice, trip.id, day.id)
    expect(routed.route).toMatchObject({ travelMode: "WALK", encodedPolyline: "poly-WALK-3", legs: [{}, {}] })
    expect(isRouteStale(routed)).toBe(false)

    await editStop(alice, trip.id, day.id, day.stops[0].id, { toIndex: 2 })
    const after = (await getTripDetail(alice, trip.id)).days[0]
    expect(after.route).not.toBeNull()
    expect(isRouteStale(after)).toBe(true)
  })

  it("optimizes the middle stops, keeps first/last, stores the route and returns the previous order", async () => {
    const { trip, day } = await dayWith(4)
    const ids = day.stops.map((s) => s.id)
    const { day: optimized, previousStopIds } = await optimizeDay(alice, trip.id, day.id, day.version)
    expect(previousStopIds).toEqual(ids)
    expect(optimized.stops.map((s) => s.id)).toEqual([ids[0], ids[2], ids[1], ids[3]])
    expect(optimized.version).toBe(day.version + 1)
    expect(isRouteStale(optimized)).toBe(false)

    // Undo restores the previous order through the versioned reorder.
    const undone = await reorderStops(alice, trip.id, day.id, previousStopIds, optimized.version)
    expect(undone.stops.map((s) => s.id)).toEqual(ids)
  })

  it("rejects stale versions, too few stops, transit, and non-members", async () => {
    const { trip, day } = await dayWith(3)
    await expectCode(optimizeDay(alice, trip.id, day.id, day.version - 1), "CONFLICT")
    await expectCode(optimizeDay(bob, trip.id, day.id, day.version), "NOT_FOUND")

    const small = await dayWith(2)
    await expectCode(optimizeDay(alice, small.trip.id, small.day.id, small.day.version), "VALIDATION")
  })

  it("exports a walking route for a car day without touching the day", async () => {
    const { trip, day } = await dayWith(3)
    const before = (await getTripDetail(alice, trip.id)).days[0]
    const route = await exportRoute(alice, trip.id, day.id, "BICYCLE")
    expect(route).toMatchObject({ travelMode: "BICYCLE", encodedPolyline: "poly-BICYCLE-3" })
    expect((await getTripDetail(alice, trip.id)).days[0]).toEqual(before)
  })
})
