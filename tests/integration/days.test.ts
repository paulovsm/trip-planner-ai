import { describe, expect, it } from "vitest"
import { addStop, createDay, editStop, removeStopFromDay, reorderStops, updateDay } from "@/lib/server/commands/days"
import { createPlace, deletePlace, updatePlace } from "@/lib/server/commands/places"
import { createTrip, getTripDetail } from "@/lib/server/commands/trips"
import { alice, belem, expectCode, jeronimos, lxFactory } from "./helpers"

async function dayWithThreeStops() {
  const trip = await createTrip(alice, { name: "Lisboa" })
  const places = [
    await createPlace(alice, trip.id, belem),
    await createPlace(alice, trip.id, jeronimos),
    await createPlace(alice, trip.id, lxFactory),
  ]
  let day = await createDay(alice, trip.id, { date: "2026-12-03" })
  for (const p of places) day = await addStop(alice, trip.id, day.id, { placeId: p.id })
  return { trip, places, day }
}

const placeOrder = (stops: { placeId: string }[], places: { id: string; name: string }[]) =>
  stops.map((s) => places.find((p) => p.id === s.placeId)!.name)

describe("days and stops", () => {
  it("keeps one Day per date", async () => {
    const trip = await createTrip(alice, { name: "Lisboa" })
    const d1 = await createDay(alice, trip.id, { date: "2026-12-03" })
    const d2 = await createDay(alice, trip.id, { date: "2026-12-04" })
    await expectCode(createDay(alice, trip.id, { date: "2026-12-03" }), "CONFLICT")
    await expectCode(updateDay(alice, trip.id, d2.id, { date: "2026-12-03" }), "CONFLICT")
    expect((await updateDay(alice, trip.id, d1.id, { travelMode: "BICYCLE" })).travelMode).toBe("BICYCLE")
  })

  it("adds stops only for places of the same trip", async () => {
    const { trip, day } = await dayWithThreeStops()
    expect(day.stops).toHaveLength(3)
    expect(day.version).toBe(3)
    await expectCode(addStop(alice, trip.id, day.id, { placeId: "nope" }), "NOT_FOUND")
  })

  it("serializes concurrent moves from co-editors without losing either", async () => {
    const { trip, places, day } = await dayWithThreeStops()
    const [a, , c] = day.stops
    await Promise.all([
      editStop(alice, trip.id, day.id, a.id, { toIndex: 2 }),
      editStop(alice, trip.id, day.id, c.id, { notes: "Comprar ingresso" }),
    ])
    const after = (await getTripDetail(alice, trip.id)).days[0]
    expect(after.version).toBe(day.version + 2)
    expect(after.stops.at(-1)?.id).toBe(a.id)
    expect(after.stops.find((s) => s.id === c.id)?.notes).toBe("Comprar ingresso")
    expect(placeOrder(after.stops, places)).toHaveLength(3)
  })

  it("rejects whole-order replacement with a stale version (409)", async () => {
    const { trip, places, day } = await dayWithThreeStops()
    const reversed = [...day.stops].reverse().map((s) => s.id)
    const next = await reorderStops(alice, trip.id, day.id, reversed, day.version)
    expect(placeOrder(next.stops, places)).toEqual(["LX Factory", "Mosteiro dos Jerónimos", "Torre de Belém"])
    await expectCode(reorderStops(alice, trip.id, day.id, reversed, day.version), "CONFLICT")
  })

  it("moves a stop to another day", async () => {
    const { trip, day } = await dayWithThreeStops()
    const other = await createDay(alice, trip.id, { date: "2026-12-04" })
    const moved = day.stops[1]
    const [from, to] = await editStop(alice, trip.id, day.id, moved.id, { toDayId: other.id, time: "10:00" })
    expect(from.stops.map((s) => s.id)).not.toContain(moved.id)
    expect(to.stops).toEqual([{ ...moved, time: "10:00" }])
  })

  it("deleting a place removes its stops from every day", async () => {
    const { trip, places, day } = await dayWithThreeStops()
    const other = await createDay(alice, trip.id, { date: "2026-12-04" })
    await addStop(alice, trip.id, other.id, { placeId: places[0].id })
    await deletePlace(alice, trip.id, places[0].id)
    const detail = await getTripDetail(alice, trip.id)
    expect(detail.places).toHaveLength(2)
    for (const d of detail.days) expect(d.stops.some((s) => s.placeId === places[0].id)).toBe(false)
    expect(detail.days.find((d) => d.id === day.id)!.stops).toHaveLength(2)
  })

  it("visited is absolute and idempotent (safe for offline replay)", async () => {
    const { trip, places } = await dayWithThreeStops()
    const first = await updatePlace(alice, trip.id, places[0].id, { visited: true })
    const replay = await updatePlace(alice, trip.id, places[0].id, { visited: true })
    expect(replay.visited).toBe(true)
    expect(replay.visitedAt).toBe(first.visitedAt)
    const undone = await updatePlace(alice, trip.id, places[0].id, { visited: false })
    expect(undone.visitedAt).toBeUndefined()
  })

  it("removes a stop", async () => {
    const { trip, day } = await dayWithThreeStops()
    const next = await removeStopFromDay(alice, trip.id, day.id, day.stops[0].id)
    expect(next.stops).toHaveLength(2)
    await expectCode(removeStopFromDay(alice, trip.id, day.id, day.stops[0].id), "NOT_FOUND")
  })
})
