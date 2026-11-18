import { describe, expect, it } from "vitest"
import { countPlacesInPartialJson, detectImportType, ImportResult } from "./import"

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)))

describe("detectImportType", () => {
  it("recognizes supported formats by magic bytes", () => {
    expect(detectImportType(bytes("%PDF-1.7\n"))).toBe("application/pdf")
    expect(detectImportType(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg")
    expect(detectImportType(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png")
    expect(detectImportType(bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 "))).toBe("image/webp")
    expect(detectImportType(bytes([0, 0, 0, 0x18], "ftypheic"))).toBe("image/heic")
    expect(detectImportType(bytes([0x50, 0x4b, 0x03, 0x04], "....[Content_Types].xml....word/document.xml"))).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
  })

  it("rejects renamed executables, plain zips and text", () => {
    expect(detectImportType(bytes("MZ\x90\x00"))).toBeNull() // Windows .exe renamed to .pdf
    expect(detectImportType(bytes([0x7f], "ELF"))).toBeNull()
    expect(detectImportType(bytes([0x50, 0x4b, 0x03, 0x04], "xl/workbook.xml"))).toBeNull()
    expect(detectImportType(bytes("hello"))).toBeNull()
    expect(detectImportType(new Uint8Array())).toBeNull()
  })
})

describe("ImportResult", () => {
  it("accepts a well-formed extraction", () => {
    const ok = ImportResult.safeParse({
      places: [{ name: "Torre de Belém", category: "historia", city: "Lisboa" }],
      days: [{ dayNumber: 1, date: "2026-12-03", places: ["Torre de Belém"] }],
    })
    expect(ok.success).toBe(true)
  })

  it("rejects unknown categories, bad dates and oversized lists", () => {
    expect(ImportResult.safeParse({ places: [{ name: "X", category: "museum" }], days: [] }).success).toBe(false)
    expect(ImportResult.safeParse({ places: [], days: [{ dayNumber: 1, date: "03/12", places: [] }] }).success).toBe(
      false,
    )
    const many = Array.from({ length: 201 }, (_, i) => ({ name: `P${i}`, category: "outros" }))
    expect(ImportResult.safeParse({ places: many, days: [] }).success).toBe(false)
  })
})

describe("countPlacesInPartialJson", () => {
  it("counts places in a JSON answer that is still streaming", () => {
    expect(countPlacesInPartialJson("")).toBe(0)
    expect(countPlacesInPartialJson('{"places":[{"name":"Prado","category":"cultura"},{"name" : "Ret')).toBe(2)
    expect(countPlacesInPartialJson('{"places":[{"name":"A"}],"days":[{"dayNumber":1,"places":["A"]}]}')).toBe(1)
  })
})
