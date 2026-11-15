import { describe, expect, it } from "vitest"
import { checkTripAccess } from "./access"

const trip = {
  members: {
    owner1: { email: "o@x.com", role: "owner" as const, joinedAt: "2026-11-15T00:00:00.000Z" },
    ed1: { email: "e@x.com", role: "editor" as const, joinedAt: "2026-11-15T00:00:00.000Z" },
  },
}

describe("checkTripAccess", () => {
  it("lets owners do everything and editors edit", () => {
    expect(checkTripAccess(trip, "owner1", "owner")).toBe("owner")
    expect(checkTripAccess(trip, "owner1", "editor")).toBe("owner")
    expect(checkTripAccess(trip, "ed1", "editor")).toBe("editor")
  })

  it("forbids editors from owner actions", () => {
    expect(() => checkTripAccess(trip, "ed1", "owner")).toThrow(expect.objectContaining({ code: "FORBIDDEN" }))
  })

  it("hides trips from non-members and missing trips behind NOT_FOUND", () => {
    expect(() => checkTripAccess(trip, "stranger", "editor")).toThrow(expect.objectContaining({ code: "NOT_FOUND" }))
    expect(() => checkTripAccess(null, "owner1", "editor")).toThrow(expect.objectContaining({ code: "NOT_FOUND" }))
  })
})
