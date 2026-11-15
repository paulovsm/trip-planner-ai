import { describe, expect, it } from "vitest"
import { normalizeCategory } from "./categories"
import { CreatePlaceInput, CreateTripInput, Email, IsoDate, LatLng, TimeOfDay, UpdateStopInput } from "./schemas"

describe("IsoDate", () => {
  it("accepts real calendar dates only", () => {
    expect(IsoDate.safeParse("2026-12-03").success).toBe(true)
    expect(IsoDate.safeParse("2026-02-30").success).toBe(false)
    expect(IsoDate.safeParse("2026-12-03T10:00:00Z").success).toBe(false)
    expect(IsoDate.safeParse("03/12/2026").success).toBe(false)
  })
})

describe("TimeOfDay", () => {
  it("accepts HH:mm", () => {
    expect(TimeOfDay.safeParse("09:30").success).toBe(true)
    expect(TimeOfDay.safeParse("24:00").success).toBe(false)
    expect(TimeOfDay.safeParse("9:30").success).toBe(false)
  })
})

describe("LatLng", () => {
  it("rejects the 0,0 'pending' sentinel and out-of-range values", () => {
    expect(LatLng.safeParse({ lat: 38.69, lng: -9.21 }).success).toBe(true)
    expect(LatLng.safeParse({ lat: 0, lng: 0 }).success).toBe(false)
    expect(LatLng.safeParse({ lat: 91, lng: 0 }).success).toBe(false)
    expect(LatLng.safeParse({ lat: 10, lng: -181 }).success).toBe(false)
  })
})

describe("Email", () => {
  it("normalizes case and whitespace", () => {
    expect(Email.parse("  Ana@Example.COM ")).toBe("ana@example.com")
    expect(Email.safeParse("not-an-email").success).toBe(false)
  })
})

describe("CreateTripInput", () => {
  it("requires a name and an ordered date range", () => {
    expect(CreateTripInput.safeParse({ name: "Lisboa" }).success).toBe(true)
    expect(CreateTripInput.safeParse({ name: "  " }).success).toBe(false)
    expect(CreateTripInput.safeParse({ name: "x".repeat(121) }).success).toBe(false)
    expect(
      CreateTripInput.safeParse({ name: "Lisboa", startDate: "2026-12-10", endDate: "2026-12-01" }).success,
    ).toBe(false)
  })
})

describe("CreatePlaceInput", () => {
  it("rejects oversize text and unknown categories", () => {
    const base = { name: "Torre de Belém", category: "historia", location: { lat: 38.69, lng: -9.21 } }
    expect(CreatePlaceInput.safeParse(base).success).toBe(true)
    expect(CreatePlaceInput.safeParse({ ...base, category: "museum" }).success).toBe(false)
    expect(CreatePlaceInput.safeParse({ ...base, description: "x".repeat(2001) }).success).toBe(false)
  })
})

describe("UpdateStopInput", () => {
  it("allows null to clear fields", () => {
    expect(UpdateStopInput.parse({ time: null, notes: null })).toEqual({ time: null, notes: null })
    expect(UpdateStopInput.safeParse({ durationMin: -5 }).success).toBe(false)
  })
})

describe("normalizeCategory", () => {
  it("maps free text and synonyms to canonical categories", () => {
    expect(normalizeCategory("Gastronomia")).toBe("gastronomia")
    expect(normalizeCategory("Restaurante típico")).toBe("gastronomia")
    expect(normalizeCategory("História")).toBe("historia")
    expect(normalizeCategory("Museu Nacional")).toBe("cultura")
    expect(normalizeCategory("")).toBe("outros")
    expect(normalizeCategory("qualquer coisa")).toBe("outros")
  })

  it("matches whole-word prefixes, not substrings", () => {
    // "embarcação" contains "bar" but is not a bar.
    expect(normalizeCategory("embarcação")).toBe("outros")
  })
})
