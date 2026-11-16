import { describe, expect, it } from "vitest"
import { categoryFromGoogleTypes, cityFromAddressComponents } from "./google-types"

describe("categoryFromGoogleTypes", () => {
  it("maps specific types before generic ones", () => {
    expect(categoryFromGoogleTypes(["museum", "tourist_attraction", "point_of_interest"])).toBe("cultura")
    expect(categoryFromGoogleTypes(["historical_landmark", "tourist_attraction"])).toBe("historia")
    expect(categoryFromGoogleTypes(["restaurant", "food", "point_of_interest"])).toBe("gastronomia")
    expect(categoryFromGoogleTypes(["lodging", "restaurant"])).toBe("hospedagem")
    expect(categoryFromGoogleTypes(["train_station", "transit_station"])).toBe("transporte")
    expect(categoryFromGoogleTypes(["tourist_attraction"])).toBe("turismo")
  })

  it("falls back to outros", () => {
    expect(categoryFromGoogleTypes(["dentist"])).toBe("outros")
    expect(categoryFromGoogleTypes(undefined)).toBe("outros")
  })
})

describe("cityFromAddressComponents", () => {
  it("prefers locality", () => {
    expect(
      cityFromAddressComponents([
        { longText: "Lisboa", types: ["administrative_area_level_2", "political"] },
        { longText: "Belém", types: ["locality", "political"] },
      ]),
    ).toBe("Belém")
    expect(cityFromAddressComponents([{ longText: "Sintra", types: ["administrative_area_level_2"] }])).toBe("Sintra")
    expect(cityFromAddressComponents([])).toBeUndefined()
  })
})
