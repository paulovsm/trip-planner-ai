import "server-only"
import { createHash, randomBytes } from "node:crypto"
import type { CreatedShareLink, PublicPlace, PublicTripDto, ShareLinkView } from "@/lib/domain/dto"
import { notFound } from "@/lib/domain/errors"
import { Day, Place, ShareLink, Trip } from "@/lib/domain/schemas"
import { requireTripAccess, tripRef, type SessionUser } from "../authz"
import { firestore } from "../firebase"
import { nowIso, readDoc, toFirestore } from "../firestore-io"

// ADR-0006: 256-bit bearer tokens, stored only as sha256(token); shown once.

const links = () => firestore.collection("shareLinks")
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/
const DAY_MS = 86_400_000

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex")

function view(link: ShareLink, now = Date.now()): ShareLinkView {
  const status = link.revokedAt ? "revoked" : Date.parse(link.expiresAt) <= now ? "expired" : "active"
  return { id: link.id, createdAt: link.createdAt, expiresAt: link.expiresAt, revokedAt: link.revokedAt, status }
}

export async function createShareLink(
  user: SessionUser,
  tripId: string,
  expiresInDays: number,
): Promise<CreatedShareLink> {
  await requireTripAccess(tripId, user.id, "owner")
  const token = randomBytes(32).toString("base64url")
  const now = new Date()
  const link = ShareLink.parse({
    id: hashToken(token),
    tripId,
    createdBy: user.id,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + expiresInDays * DAY_MS).toISOString(),
    revokedAt: null,
  })
  await links().doc(link.id).set(toFirestore(link))
  return { ...view(link), token, path: `/shared/${token}` }
}

export async function listShareLinks(user: SessionUser, tripId: string): Promise<ShareLinkView[]> {
  await requireTripAccess(tripId, user.id, "owner")
  const snap = await links().where("tripId", "==", tripId).orderBy("createdAt", "desc").get()
  return snap.docs.map((d) => view(readDoc(ShareLink, d)))
}

export async function revokeShareLink(user: SessionUser, tripId: string, linkId: string): Promise<void> {
  await requireTripAccess(tripId, user.id, "owner")
  await firestore.runTransaction(async (tx) => {
    const ref = links().doc(linkId)
    const snap = await tx.get(ref)
    if (!snap.exists || snap.get("tripId") !== tripId) throw notFound("Link")
    if (!snap.get("revokedAt")) tx.update(ref, { revokedAt: nowIso() })
  })
}

const publicPlace = (p: Place): PublicPlace => ({
  name: p.name,
  category: p.category,
  address: p.address,
  city: p.city,
  location: p.location,
  visited: p.visited,
})

/**
 * Resolves a token to the public, read-only Trip view. Unknown, malformed,
 * revoked and expired links are indistinguishable (all NOT_FOUND).
 */
export async function getPublicTrip(token: string): Promise<PublicTripDto> {
  if (!TOKEN_RE.test(token)) throw notFound("Link")
  const snap = await links().doc(hashToken(token)).get()
  if (!snap.exists) throw notFound("Link")
  const link = readDoc(ShareLink, snap)
  if (view(link).status !== "active") throw notFound("Link")

  const ref = tripRef(link.tripId)
  const [tripSnap, placesSnap, daysSnap] = await Promise.all([
    ref.get(),
    ref.collection("places").orderBy("createdAt").get(),
    ref.collection("days").orderBy("date").get(),
  ])
  if (!tripSnap.exists) throw notFound("Link")
  const trip = readDoc(Trip, tripSnap)
  const places = placesSnap.docs.map((d) => readDoc(Place, d))
  const byId = new Map(places.map((p) => [p.id, p]))

  // Explicit whitelist — never spread stored documents into the public payload.
  return {
    name: trip.name,
    description: trip.description,
    startDate: trip.startDate,
    endDate: trip.endDate,
    places: places.map(publicPlace),
    days: daysSnap.docs.map((d) => {
      const day = readDoc(Day, d)
      return {
        date: day.date,
        travelMode: day.travelMode,
        stops: day.stops
          .filter((s) => byId.has(s.placeId))
          .map((s) => ({ time: s.time, durationMin: s.durationMin, place: publicPlace(byId.get(s.placeId)!) })),
      }
    }),
  }
}
