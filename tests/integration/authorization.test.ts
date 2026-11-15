import { describe, expect, it } from "vitest"
import { createDay, addStop, deleteDay, reorderStops } from "@/lib/server/commands/days"
import { claimInvites, inviteMember, isAllowedEmail, removeMember } from "@/lib/server/commands/members"
import { createPlace, deletePlace, updatePlace } from "@/lib/server/commands/places"
import { createShareLink, listShareLinks } from "@/lib/server/commands/share-links"
import { createTrip, deleteTrip, getTripDetail, listTrips, updateTrip } from "@/lib/server/commands/trips"
import { alice, belem, bob, carol, expectCode, registerUser } from "./helpers"

describe("trip isolation (IDOR)", () => {
  it("non-members get NOT_FOUND on every trip-scoped command", async () => {
    const trip = await createTrip(alice, { name: "Lisboa" })
    const place = await createPlace(alice, trip.id, belem)
    const day = await createDay(alice, trip.id, { date: "2026-12-03" })

    await expectCode(getTripDetail(bob, trip.id), "NOT_FOUND")
    await expectCode(updateTrip(bob, trip.id, { name: "hacked" }), "NOT_FOUND")
    await expectCode(deleteTrip(bob, trip.id), "NOT_FOUND")
    await expectCode(createPlace(bob, trip.id, belem), "NOT_FOUND")
    await expectCode(updatePlace(bob, trip.id, place.id, { visited: true }), "NOT_FOUND")
    await expectCode(deletePlace(bob, trip.id, place.id), "NOT_FOUND")
    await expectCode(createDay(bob, trip.id, { date: "2026-12-04" }), "NOT_FOUND")
    await expectCode(deleteDay(bob, trip.id, day.id), "NOT_FOUND")
    await expectCode(addStop(bob, trip.id, day.id, { placeId: place.id }), "NOT_FOUND")
    await expectCode(reorderStops(bob, trip.id, day.id, [], 0), "NOT_FOUND")
    await expectCode(createShareLink(bob, trip.id, 30), "NOT_FOUND")
    await expectCode(listShareLinks(bob, trip.id), "NOT_FOUND")
    await expectCode(inviteMember(bob, trip.id, "x@example.com"), "NOT_FOUND")

    // Nothing changed.
    const detail = await getTripDetail(alice, trip.id)
    expect(detail.trip.name).toBe("Lisboa")
    expect(detail.places).toHaveLength(1)
    expect(await listTrips(bob)).toEqual([])
  })

  it("unknown trip ids are NOT_FOUND too", async () => {
    await expectCode(getTripDetail(alice, "does-not-exist"), "NOT_FOUND")
  })
})

describe("co-editors", () => {
  it("invited registered users become editors immediately; editors cannot do owner actions", async () => {
    await registerUser(bob)
    const trip = await createTrip(alice, { name: "Lisboa" })
    const members = await inviteMember(alice, trip.id, "Bob@Example.com")
    expect(members.map((m) => [m.email, m.role])).toEqual([
      ["alice@example.com", "owner"],
      ["bob@example.com", "editor"],
    ])

    await createPlace(bob, trip.id, belem)
    await updateTrip(bob, trip.id, { name: "Lisboa 2026" })
    expect((await getTripDetail(bob, trip.id)).role).toBe("editor")

    await expectCode(deleteTrip(bob, trip.id), "FORBIDDEN")
    await expectCode(inviteMember(bob, trip.id, "carol@example.com"), "FORBIDDEN")
    await expectCode(createShareLink(bob, trip.id, 30), "FORBIDDEN")
    await expectCode(removeMember(bob, trip.id, "alice@example.com"), "FORBIDDEN")
  })

  it("pending invitations grant sign-in and are claimed on first login", async () => {
    const trip = await createTrip(alice, { name: "Lisboa" })
    expect(await isAllowedEmail(carol.email)).toBe(false)

    const members = await inviteMember(alice, trip.id, carol.email)
    expect(members.at(-1)).toEqual({ email: carol.email, role: "pending" })
    expect(await isAllowedEmail(carol.email)).toBe(true)
    await expectCode(getTripDetail(carol, trip.id), "NOT_FOUND")

    expect(await claimInvites(carol.id, carol.email)).toBe(1)
    expect(await claimInvites(carol.id, carol.email)).toBe(0) // idempotent
    expect((await getTripDetail(carol, trip.id)).role).toBe("editor")
    expect((await listTrips(carol)).map((t) => t.id)).toEqual([trip.id])
  })

  it("removing a member revokes access and sign-in immediately", async () => {
    await registerUser(bob)
    const trip = await createTrip(alice, { name: "Lisboa" })
    await inviteMember(alice, trip.id, bob.email)
    await removeMember(alice, trip.id, bob.email)

    await expectCode(getTripDetail(bob, trip.id), "NOT_FOUND")
    expect(await isAllowedEmail(bob.email)).toBe(false)
    await expectCode(removeMember(alice, trip.id, alice.email), "VALIDATION")
  })

  it("rejects duplicate invitations", async () => {
    const trip = await createTrip(alice, { name: "Lisboa" })
    await inviteMember(alice, trip.id, carol.email)
    await expectCode(inviteMember(alice, trip.id, carol.email), "CONFLICT")
    await expectCode(inviteMember(alice, trip.id, alice.email), "CONFLICT")
  })

  it("owner can delete the trip with everything under it", async () => {
    const trip = await createTrip(alice, { name: "Lisboa" })
    await createPlace(alice, trip.id, belem)
    await createDay(alice, trip.id, { date: "2026-12-03" })
    await createShareLink(alice, trip.id, 30)
    await deleteTrip(alice, trip.id)
    await expectCode(getTripDetail(alice, trip.id), "NOT_FOUND")
  })
})
