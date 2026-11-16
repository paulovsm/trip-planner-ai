import { describe, expect, it } from "vitest"
import { toCommit, type ReviewRow } from "./import-plan"

const loc = { lat: 38.7, lng: -9.1 }
const rows: ReviewRow[] = [
  { key: "1", include: true, name: "Torre de Belém", category: "historia", location: loc, googlePlaceId: "g1" },
  { key: "2", include: true, name: "Lugar sem mapa", category: "outros" },
  { key: "3", include: false, name: "Excluído", category: "outros", location: loc },
  { key: "4", include: true, name: "LX Factory", category: "compras", location: loc },
]

describe("toCommit", () => {
  it("keeps included, located places and maps day names case-insensitively", () => {
    const commit = toCommit(rows, [
      { key: "a", dayNumber: 1, date: "2026-12-03", places: ["torre de belém", "Lugar sem mapa", "LX Factory", "LX Factory", "Excluído"] },
    ])
    expect(commit.places.map((p) => [p.name, p.googlePlaceId])).toEqual([
      ["Torre de Belém", "g1"],
      ["LX Factory", undefined],
    ])
    expect(commit.days).toEqual([{ date: "2026-12-03", placeIndexes: [0, 1] }])
  })

  it("drops undated days and days without kept places", () => {
    const commit = toCommit(rows, [
      { key: "a", dayNumber: 1, date: "", places: ["LX Factory"] },
      { key: "b", dayNumber: 2, date: "2026-12-04", places: ["Excluído"] },
    ])
    expect(commit.days).toEqual([])
  })
})
