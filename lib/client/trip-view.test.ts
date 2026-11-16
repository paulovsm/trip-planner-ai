import { describe, expect, it } from "vitest"
import type { TripDetail } from "@/lib/domain/dto"
import type { Day, Place } from "@/lib/domain/schemas"
import { dayChipLabel, dayLongLabel, dayPath, defaultDay, googleMapsDayUrl, mapPins, tripDatesLabel } from "./trip-view"

const ts = "2026-11-15T00:00:00.000Z"
const place = (id: string, lat: number, lng: number): Place => ({
  id,
  name: id,
  category: "turismo",
  location: { lat, lng },
  visited: false,
  source: "manual",
  createdBy: "u",
  createdAt: ts,
  updatedAt: ts,
})
const day = (id: string, date: string, placeIds: string[]): Day => ({
  id,
  date,
  travelMode: "WALK",
  stops: placeIds.map((p, i) => ({ id: `${id}-s${i}`, placeId: p })),
  version: 0,
  route: null,
  createdAt: ts,
  updatedAt: ts,
  updatedBy: "u",
})
const detail: TripDetail = {
  trip: { id: "t", name: "T", ownerId: "u", updatedAt: ts },
  role: "owner",
  members: [],
  places: [place("a", 1, 1), place("b", 2, 2), place("c", 3, 3)],
  days: [day("d1", "2026-12-03", ["b", "a", "gone"]), day("d2", "2026-12-05", ["c"])],
}

describe("trip view model", () => {
  it("numbers pins of the selected day in stop order", () => {
    const pins = mapPins(detail, detail.days[0])
    expect(pins.map((p) => [p.key, p.order])).toEqual([
      ["a", 2],
      ["b", 1],
      ["c", undefined],
    ])
  })

  it("builds the day path skipping removed places", () => {
    expect(dayPath(detail, detail.days[0])).toEqual([
      { lat: 2, lng: 2 },
      { lat: 1, lng: 1 },
    ])
    expect(dayPath(detail, null)).toEqual([])
  })

  it("picks today, then the next upcoming day, then the first", () => {
    expect(defaultDay(detail.days, new Date(2026, 11, 3))?.id).toBe("d1")
    expect(defaultDay(detail.days, new Date(2026, 11, 4))?.id).toBe("d2")
    expect(defaultDay(detail.days, new Date(2027, 0, 1))?.id).toBe("d1")
    expect(defaultDay([], new Date())).toBeUndefined()
  })

  it("capitalizes only the first letter of day labels", () => {
    expect(dayLongLabel("2026-12-03")).toBe("Quinta-feira, 3 de dezembro")
    expect(dayChipLabel("2026-12-03")).toMatch(/^Qui/)
  })

  it("formats trip dates", () => {
    expect(tripDatesLabel()).toBe("Datas a definir")
    expect(tripDatesLabel("2026-12-03", "2026-12-08")).toBe("3 dez – 8 dez 2026")
    expect(tripDatesLabel("2026-12-30", "2027-01-02")).toBe("30 dez 2026 – 2 jan 2027")
  })

  it("builds Google Maps directions links in the day's mode", () => {
    const url = new URL(googleMapsDayUrl([{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }, { lat: 3, lng: 3 }], "BICYCLE")!)
    expect(url.searchParams.get("travelmode")).toBe("bicycling")
    expect(url.searchParams.get("waypoints")).toBe("2,2")
    expect(googleMapsDayUrl([{ lat: 1, lng: 1 }], "WALK")).toBeNull()
  })
})
