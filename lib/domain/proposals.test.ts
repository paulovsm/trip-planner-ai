import { describe, expect, it } from "vitest"
import { TOOL_ARGS } from "@/lib/ai/tools"
import { ProposalArgError, resolveAction, summarize, type ResolveContext } from "./proposals"

const pasteis = {
  googlePlaceId: "g-pasteis",
  name: "Pastéis de Belém",
  city: "Lisboa",
  category: "gastronomia" as const,
  location: { lat: 38.697, lng: -9.203 },
}
const ctx: ResolveContext = {
  refs: new Map([
    ["P1", "id-torre"],
    ["P2", "id-lx"],
  ]),
  placeNames: new Map([
    ["id-torre", "Torre de Belém"],
    ["id-lx", "LX Factory"],
  ]),
  searchResults: new Map([[pasteis.googlePlaceId, pasteis]]),
  existingByGoogleId: new Map(),
}

describe("tool args", () => {
  it("validate shapes before resolution", () => {
    expect(TOOL_ARGS.proposeAddStop.safeParse({ date: "2026-12-03", placeRef: "P1" }).success).toBe(true)
    expect(TOOL_ARGS.proposeAddStop.safeParse({ date: "2026-12-03" }).success).toBe(false)
    expect(TOOL_ARGS.proposeAddStop.safeParse({ date: "2026-12-03", placeRef: "P1", googlePlaceId: "g" }).success).toBe(false)
    expect(TOOL_ARGS.proposeMarkVisited.safeParse({ placeRef: "abc123", visited: true }).success).toBe(false)
  })
})

describe("resolveAction", () => {
  it("maps refs to ids and search results to trusted places", () => {
    expect(resolveAction("proposeAddStop", { date: "2026-12-03", placeRef: "P2", time: "10:00" }, ctx)).toEqual({
      kind: "addStop",
      date: "2026-12-03",
      placeId: "id-lx",
      time: "10:00",
    })
    expect(resolveAction("proposeAddStop", { date: "2026-12-03", googlePlaceId: "g-pasteis" }, ctx)).toMatchObject({
      kind: "addStop",
      place: pasteis,
    })
    expect(resolveAction("proposePlanDays", { days: [{ date: "2026-12-04", placeRefs: ["P1", "P1", "P2"] }] }, ctx)).toEqual({
      kind: "planDays",
      days: [{ date: "2026-12-04", placeIds: ["id-torre", "id-lx"] }],
    })
  })

  it("reuses an already-saved place found again on Google", () => {
    const withExisting = { ...ctx, existingByGoogleId: new Map([["g-pasteis", "id-pasteis"]]) }
    expect(resolveAction("proposeAddStop", { date: "2026-12-03", googlePlaceId: "g-pasteis" }, withExisting)).toEqual({
      kind: "addStop",
      date: "2026-12-03",
      placeId: "id-pasteis",
      time: undefined,
    })
    expect(() => resolveAction("proposeAddPlace", { googlePlaceId: "g-pasteis" }, withExisting)).toThrow(/já está salvo/)
  })

  it("rejects invented refs and place ids (sent back to the model)", () => {
    expect(() => resolveAction("proposeMarkVisited", { placeRef: "P9", visited: true }, ctx)).toThrow(ProposalArgError)
    expect(() => resolveAction("proposeAddPlace", { googlePlaceId: "made-up" }, ctx)).toThrow(/searchPlaces/)
  })
})

describe("summarize", () => {
  it("produces readable pt-BR card text", () => {
    expect(summarize({ kind: "addStop", date: "2026-12-03", place: pasteis, time: "10:00" }, ctx.placeNames)).toBe(
      "Adicionar Pastéis de Belém em quinta, 3/12 às 10:00",
    )
    expect(summarize({ kind: "markVisited", placeId: "id-torre", visited: true }, ctx.placeNames)).toBe(
      "Marcar Torre de Belém como visitado",
    )
    expect(summarize({ kind: "planDays", days: [{ date: "2026-12-04", placeIds: ["id-torre", "id-lx"] }] }, ctx.placeNames)).toBe(
      "sexta, 4/12: Torre de Belém, LX Factory",
    )
  })
})
