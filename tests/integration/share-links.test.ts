import { describe, expect, it } from "vitest"
import { addStop, createDay, editStop } from "@/lib/server/commands/days"
import { createPlace } from "@/lib/server/commands/places"
import { createShareLink, getPublicTrip, hashToken, listShareLinks, revokeShareLink } from "@/lib/server/commands/share-links"
import { createTrip } from "@/lib/server/commands/trips"
import { firestore } from "@/lib/server/firebase"
import { enforceRateLimit } from "@/lib/server/rate-limit"
import { alice, belem, expectCode } from "./helpers"

/** Recursively collects object keys. */
function allKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, out))
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.add(k)
      allKeys(v, out)
    }
  }
  return out
}

describe("share links", () => {
  it("stores only the token hash and returns the token once", async () => {
    const trip = await createTrip(alice, { name: "Lisboa" })
    const link = await createShareLink(alice, trip.id, 30)
    expect(link.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(link.id).toBe(hashToken(link.token))
    expect(link.path).toBe(`/shared/${link.token}`)

    const stored = await firestore.collection("shareLinks").doc(link.id).get()
    expect(JSON.stringify(stored.data())).not.toContain(link.token)
    expect((await listShareLinks(alice, trip.id)).map((l) => l.status)).toEqual(["active"])
  })

  it("public view has no ids, emails, owner identity or notes", async () => {
    const trip = await createTrip(alice, { name: "Lisboa" })
    const place = await createPlace(alice, trip.id, belem)
    const day = await createDay(alice, trip.id, { date: "2026-12-03" })
    const withStop = await addStop(alice, trip.id, day.id, { placeId: place.id })
    await editStop(alice, trip.id, day.id, withStop.stops[0].id, { notes: "Código da reserva 1234", time: "10:00" })
    const { token } = await createShareLink(alice, trip.id, 30)

    const dto = await getPublicTrip(token)
    expect(dto.name).toBe("Lisboa")
    expect(dto.days[0].stops[0]).toMatchObject({ time: "10:00", place: { name: "Torre de Belém" } })
    const keys = [...allKeys(dto)]
    expect(keys.filter((k) => /id$|userid|email|owner|member|notes|createdby/i.test(k))).toEqual([])
    expect(JSON.stringify(dto)).not.toContain("1234")
    expect(JSON.stringify(dto)).not.toContain(alice.email)
  })

  it("revoked, expired, unknown and malformed tokens are all NOT_FOUND", async () => {
    const trip = await createTrip(alice, { name: "Lisboa" })
    const revoked = await createShareLink(alice, trip.id, 30)
    await revokeShareLink(alice, trip.id, revoked.id)
    await expectCode(getPublicTrip(revoked.token), "NOT_FOUND")

    const expired = await createShareLink(alice, trip.id, 1)
    await firestore.collection("shareLinks").doc(expired.id).update({ expiresAt: new Date(Date.now() - 1000) })
    await expectCode(getPublicTrip(expired.token), "NOT_FOUND")

    await expectCode(getPublicTrip("A".repeat(43)), "NOT_FOUND")
    await expectCode(getPublicTrip("../../etc"), "NOT_FOUND")

    expect((await listShareLinks(alice, trip.id)).map((l) => l.status).sort()).toEqual(["expired", "revoked"])
  })

  it("cannot revoke another trip's link", async () => {
    const t1 = await createTrip(alice, { name: "A" })
    const t2 = await createTrip(alice, { name: "B" })
    const link = await createShareLink(alice, t1.id, 30)
    await expectCode(revokeShareLink(alice, t2.id, link.id), "NOT_FOUND")
  })
})

describe("rate limit", () => {
  it("blocks after the per-minute limit", async () => {
    for (let i = 0; i < 3; i++) await enforceRateLimit("import", "user-x")
    await expectCode(enforceRateLimit("import", "user-x"), "RATE_LIMITED")
    await enforceRateLimit("import", "user-y") // other keys unaffected
  })
})
