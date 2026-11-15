import "server-only"
import { FieldValue, type Transaction } from "firebase-admin/firestore"
import type { TripDetail, TripSummary } from "@/lib/domain/dto"
import { validation } from "@/lib/domain/errors"
import { Day, Place, Trip, type CreateTripInput, type UpdateTripInput } from "@/lib/domain/schemas"
import { requireTripAccess, tripRef, type SessionUser } from "../authz"
import { firestore } from "../firebase"
import { nowIso, readDoc, toFirestore } from "../firestore-io"
import { claimInvites, memberViews } from "./members"

export async function listTrips(user: SessionUser): Promise<TripSummary[]> {
  await claimInvites(user.id, user.email)
  const snap = await firestore
    .collection("trips")
    .where("memberIds", "array-contains", user.id)
    .orderBy("updatedAt", "desc")
    .get()
  return Promise.all(
    snap.docs.map(async (doc) => {
      const trip = readDoc(Trip, doc)
      const places = await doc.ref.collection("places").count().get()
      return {
        id: trip.id,
        name: trip.name,
        description: trip.description,
        startDate: trip.startDate,
        endDate: trip.endDate,
        updatedAt: trip.updatedAt,
        role: trip.members[user.id].role,
        placeCount: places.data().count,
        memberCount: trip.memberIds.length + trip.pendingEmails.length,
      }
    }),
  )
}

export async function createTrip(user: SessionUser, input: CreateTripInput): Promise<Trip> {
  const ref = firestore.collection("trips").doc()
  const now = nowIso()
  const trip = Trip.parse({
    ...input,
    id: ref.id,
    ownerId: user.id,
    members: { [user.id]: { email: user.email, role: "owner", joinedAt: now } },
    memberIds: [user.id],
    memberEmails: [user.email],
    pendingEmails: [],
    schemaVersion: 2,
    createdAt: now,
    updatedAt: now,
  })
  await ref.set(toFirestore(trip))
  return trip
}

export async function getTripDetail(user: SessionUser, tripId: string): Promise<TripDetail> {
  const { trip, ref, role } = await requireTripAccess(tripId, user.id, "editor")
  const [places, days] = await Promise.all([
    ref.collection("places").orderBy("createdAt").get(),
    ref.collection("days").orderBy("date").get(),
  ])
  return {
    trip: {
      id: trip.id,
      name: trip.name,
      description: trip.description,
      startDate: trip.startDate,
      endDate: trip.endDate,
      ownerId: trip.ownerId,
      updatedAt: trip.updatedAt,
    },
    role,
    members: memberViews(trip),
    places: places.docs.map((d) => readDoc(Place, d)),
    days: days.docs.map((d) => readDoc(Day, d)),
  }
}

export async function updateTrip(user: SessionUser, tripId: string, input: UpdateTripInput): Promise<void> {
  await firestore.runTransaction(async (tx) => {
    const { trip, ref } = await requireTripAccess(tripId, user.id, "editor", tx)
    const start = input.startDate === undefined ? trip.startDate : (input.startDate ?? undefined)
    const end = input.endDate === undefined ? trip.endDate : (input.endDate ?? undefined)
    if (start && end && start > end) throw validation("A data final deve ser igual ou posterior à inicial")

    const update: Record<string, unknown> = { updatedAt: nowIso() }
    for (const key of ["name", "description", "startDate", "endDate"] as const) {
      if (input[key] === undefined) continue
      update[key] = input[key] === null || input[key] === "" ? FieldValue.delete() : input[key]
    }
    tx.update(ref, update)
  })
}

/** Owner only. Deletes the Trip, all subcollections, and its Share Links. */
export async function deleteTrip(user: SessionUser, tripId: string): Promise<void> {
  const { ref } = await requireTripAccess(tripId, user.id, "owner")
  const links = await firestore.collection("shareLinks").where("tripId", "==", tripId).get()
  const batch = firestore.batch()
  links.docs.forEach((d) => batch.delete(d.ref))
  await batch.commit()
  await firestore.recursiveDelete(ref)
}

/** Bumps the Trip's updatedAt (keeps "recently updated" ordering meaningful). */
export const touchTrip = (tx: Transaction, tripId: string) =>
  tx.update(tripRef(tripId), { updatedAt: nowIso() })
