import { describe, expect, it } from "vitest"
import { ImportResult } from "@/lib/domain/import"
import { toGeminiSchema } from "./schema"

describe("toGeminiSchema", () => {
  it("keeps shape, enums and patterns but drops size constraints and $schema", () => {
    const json = JSON.stringify(toGeminiSchema(ImportResult))
    for (const key of ["$schema", "minLength", "maxLength", "minItems", "maxItems", "minimum", "maximum"]) {
      expect(json).not.toContain(`"${key}"`)
    }
    expect(json).toContain('"enum":["hospedagem"')
    expect(json).toContain('"pattern"')
    expect(json).toContain('"required":["name","category"]')
  })
})
