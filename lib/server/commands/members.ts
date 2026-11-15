import "server-only"
import { FieldValue } from "firebase-admin/firestore"
import { checkTripAccess } from "@/lib/domain/access"
import type { MemberView } from "@/lib/domain/dto"
import { conflict, DomainError, notFound } from "@/lib/domain/errors"
import { Trip } from "@/lib/domain/schemas"
import type { SessionUser } from "../authz"
import { firestore } from "../firebase"
import { nowIso, readDoc } from "../firestore-io"

const trips = () => firestore.collection("trips")

/** Lowercased emails allowed to sign in as owners (comma-separated OWNER_EMAILS env). */
export function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function memberViews(trip: Pick<Trip, "members" | "pendingEmails">): MemberView[] {
  const joined = Object.entries(trip.members).map(([userId, m]) => ({ userId, email: m.email, role: m.role }))
  joined.sort((a, b) => (a.role === b.role ? a.email.localeCompare(b.email) : a.role === "owner" ? -1 : 1))
  return [...joined, ...trip.pendingEmails.map((email) => ({ email, role: "pending" as const }))]
}

/** Allow-list (decision Q19): owners from env, plus anyone invited to at least one Trip. */
export async function isAllowedEmail(email: string): Promise<boolean> {
  const normalized = email.toLowerCase()
  if (ownerEmails().includes(normalized)) return true
  const snap = await trips().where("memberEmails", "array-contains", normalized).limit(1).get()
  return !snap.empty
}

/** Turns pending invitations for this email into memberships. Idempotent. */
export async function claimInvites(userId: string, email: string): Promise<number> {
  const normalized = email.toLowerCase()
  const pending = await trips().where("pendingEmails", "array-contains", normalized).get()
  let claimed = 0
  for (const doc of pending.docs) {
    await firestore.runTransaction(async (tx) => {
      const snap = await tx.get(doc.ref)
      const trip = readDoc(Trip, snap)
      if (!trip.pendingEmails.includes(normalized) || trip.members[userId]) return
      const now = nowIso()
      tx.update(doc.ref, {
        [`members.${userId}`]: { email: normalized, role: "editor", joinedAt: now },
        memberIds: FieldValue.arrayUnion(userId),
        pendingEmails: FieldValue.arrayRemove(normalized),
        updatedAt: now,
      })
      claimed++
    })
  }
  return claimed
}

export async function inviteMember(user: SessionUser, tripId: string, email: string): Promise<MemberView[]> {
  const ref = trips().doc(tripId)
  const normalized = email.toLowerCase()
  return firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const trip = snap.exists ? readDoc(Trip, snap) : null
    checkTripAccess(trip, user.id, "owner")
    if (trip!.memberEmails.includes(normalized)) throw conflict("Este email já é membro ou já foi convidado")

    const existing = await tx.get(firestore.collection("users").where("email", "==", normalized).limit(1))
    const now = nowIso()
    const next = { ...trip! }
    if (!existing.empty) {
      const userId = existing.docs[0].id
      next.members = { ...trip!.members, [userId]: { email: normalized, role: "editor", joinedAt: now } }
      next.memberIds = [...trip!.memberIds, userId]
      tx.update(ref, {
        [`members.${userId}`]: next.members[userId],
        memberIds: FieldValue.arrayUnion(userId),
        memberEmails: FieldValue.arrayUnion(normalized),
        updatedAt: now,
      })
    } else {
      next.pendingEmails = [...trip!.pendingEmails, normalized]
      tx.update(ref, {
        pendingEmails: FieldValue.arrayUnion(normalized),
        memberEmails: FieldValue.arrayUnion(normalized),
        updatedAt: now,
      })
    }
    return memberViews(next)
  })
}

export async function removeMember(user: SessionUser, tripId: string, email: string): Promise<MemberView[]> {
  const ref = trips().doc(tripId)
  const normalized = email.toLowerCase()
  return firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const trip = snap.exists ? readDoc(Trip, snap) : null
    checkTripAccess(trip, user.id, "owner")
    const entry = Object.entries(trip!.members).find(([, m]) => m.email === normalized)
    if (entry?.[1].role === "owner") throw new DomainError("VALIDATION", "O dono não pode ser removido")
    if (!entry && !trip!.pendingEmails.includes(normalized)) throw notFound("Membro")

    const now = nowIso()
    const update: Record<string, unknown> = {
      memberEmails: FieldValue.arrayRemove(normalized),
      pendingEmails: FieldValue.arrayRemove(normalized),
      updatedAt: now,
    }
    const members = { ...trip!.members }
    if (entry) {
      update[`members.${entry[0]}`] = FieldValue.delete()
      update.memberIds = FieldValue.arrayRemove(entry[0])
      delete members[entry[0]]
    }
    tx.update(ref, update)
    return memberViews({ members, pendingEmails: trip!.pendingEmails.filter((e) => e !== normalized) })
  })
}
