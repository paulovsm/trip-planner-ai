import { describe, expect, it } from "vitest"
import { PLACE_CATEGORIES } from "./categories"
import { CATEGORY_COLORS, VISITED_COLOR } from "./category-colors"
import { contrastRatio } from "./contrast"

describe("category colors", () => {
  it("covers every category", () => {
    expect(Object.keys(CATEGORY_COLORS).sort()).toEqual([...PLACE_CATEGORIES].sort())
  })

  it.each([...Object.entries(CATEGORY_COLORS), ["visited", VISITED_COLOR]])(
    "%s keeps white text at WCAG AA",
    (_name, color) => {
      expect(contrastRatio(color, "#FFFFFF")).toBeGreaterThanOrEqual(4.5)
    },
  )
})

describe("contrastRatio", () => {
  it("matches known values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1)
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 1)
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBe(1)
  })
})
