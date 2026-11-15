import { describe, expect, it } from "vitest"
import { DomainError } from "./errors"
import { MAX_STOPS_PER_DAY, type Stop } from "./schemas"
import { applyOrder, insertStop, moveStop, removePlace, removeStop, stopIdsKey, updateStop } from "./stops"

const s = (id: string, placeId = `p-${id}`): Stop => ({ id, placeId })
const ids = (stops: Stop[]) => stops.map((x) => x.id)
const abc = [s("a"), s("b"), s("c")]

describe("insertStop", () => {
  it("appends by default and inserts at a clamped index", () => {
    expect(ids(insertStop(abc, s("d")))).toEqual(["a", "b", "c", "d"])
    expect(ids(insertStop(abc, s("d"), 0))).toEqual(["d", "a", "b", "c"])
    expect(ids(insertStop(abc, s("d"), 99))).toEqual(["a", "b", "c", "d"])
  })

  it("does not mutate the input", () => {
    insertStop(abc, s("d"))
    expect(ids(abc)).toEqual(["a", "b", "c"])
  })

  it("rejects duplicates and lists over the limit", () => {
    expect(() => insertStop(abc, s("a"))).toThrow(DomainError)
    const full = Array.from({ length: MAX_STOPS_PER_DAY }, (_, i) => s(String(i)))
    expect(() => insertStop(full, s("x"))).toThrow(/no máximo/)
  })
})

describe("moveStop", () => {
  it("moves forward and backward", () => {
    expect(ids(moveStop(abc, "a", 2))).toEqual(["b", "c", "a"])
    expect(ids(moveStop(abc, "c", 0))).toEqual(["c", "a", "b"])
    expect(ids(moveStop(abc, "b", 1))).toEqual(["a", "b", "c"])
  })

  it("composes for two concurrent operations applied sequentially", () => {
    // Co-editor 1 moves a to the end; co-editor 2 (serialized after) moves c to the front.
    const afterFirst = moveStop(abc, "a", 2)
    expect(ids(moveStop(afterFirst, "c", 0))).toEqual(["c", "b", "a"])
  })

  it("throws NOT_FOUND for unknown stops", () => {
    expect(() => moveStop(abc, "zz", 0)).toThrow(expect.objectContaining({ code: "NOT_FOUND" }))
  })
})

describe("removeStop / removePlace", () => {
  it("removes by stop id", () => {
    expect(ids(removeStop(abc, "b"))).toEqual(["a", "c"])
    expect(() => removeStop(abc, "zz")).toThrow(DomainError)
  })

  it("removes every stop of a place", () => {
    const stops = [s("a", "p1"), s("b", "p2"), s("c", "p1")]
    expect(ids(removePlace(stops, "p1"))).toEqual(["b"])
  })
})

describe("updateStop", () => {
  it("sets and clears optional fields", () => {
    const withTime = updateStop(abc, "a", { time: "09:30", durationMin: 60, notes: "Reserva 123" })
    expect(withTime[0]).toEqual({ id: "a", placeId: "p-a", time: "09:30", durationMin: 60, notes: "Reserva 123" })
    const cleared = updateStop(withTime, "a", { time: null, notes: "" })
    expect(cleared[0]).toEqual({ id: "a", placeId: "p-a", durationMin: 60 })
  })
})

describe("applyOrder", () => {
  it("applies a permutation", () => {
    expect(ids(applyOrder(abc, ["c", "a", "b"]))).toEqual(["c", "a", "b"])
  })

  it("rejects stale or invalid orderings with CONFLICT", () => {
    for (const bad of [["a", "b"], ["a", "b", "c", "d"], ["a", "a", "b"], ["a", "b", "x"]]) {
      expect(() => applyOrder(abc, bad)).toThrow(expect.objectContaining({ code: "CONFLICT" }))
    }
  })
})

it("stopIdsKey reflects order", () => {
  expect(stopIdsKey(abc)).toBe("a,b,c")
  expect(stopIdsKey(moveStop(abc, "a", 2))).toBe("b,c,a")
})
