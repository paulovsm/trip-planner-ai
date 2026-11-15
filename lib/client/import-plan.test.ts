import { describe, expect, it } from "vitest"
import { buildImportCommit, type DraftPlace } from "./import-plan"

const loc = { lat: 38.7, lng: -9.1 }
const places: DraftPlace[] = [
  { name: "Torre de Belém", category: "historia", location: loc },
  { name: "Lugar sem mapa", category: "outros" },
  { name: "LX Factory", category: "compras", location: loc },
]

describe("buildImportCommit", () => {
  it("keeps located places and maps day names to indexes (case-insensitive)", () => {
    const { commit, skippedPlaces } = buildImportCommit(
      places,
      [{ dayNumber: 1, date: "2026-12-03", places: ["torre de belém", "Lugar sem mapa", "LX Factory", "LX Factory"] }],
    )
    expect(skippedPlaces).toBe(1)
    expect(commit.places.map((p) => p.name)).toEqual(["Torre de Belém", "LX Factory"])
    expect(commit.days).toEqual([{ date: "2026-12-03", placeIndexes: [0, 1] }])
  })

  it("derives dates from the trip start date, or skips undated days", () => {
    const days = [{ dayNumber: 2, places: ["LX Factory"] }]
    expect(buildImportCommit(places, days, "2026-12-30").commit.days[0].date).toBe("2026-12-31")
    expect(buildImportCommit(places, [{ dayNumber: 3, places: [] }], "2026-12-30").commit.days[0].date).toBe("2027-01-01")
    const none = buildImportCommit(places, days)
    expect(none.commit.days).toEqual([])
    expect(none.skippedDays).toBe(1)
  })
})
