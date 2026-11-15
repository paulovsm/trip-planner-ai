import "server-only"
import { FieldValue } from "firebase-admin/firestore"
import { notFound } from "@/lib/domain/errors"
import { Day, Place, type CreatePlaceInput, type UpdatePlaceInput } from "@/lib/domain/schemas"
import { removePlace } from "@/lib/domain/stops"
import { requireTripAccess, tripRef, type SessionUser } from "../authz"
import { firestore } from "../firebase"
import { nowIso, readDoc, toFirestore } from "../firestore-io"
import { touchTrip } from "./trips"

const placesOf = (tripId: string) => tripRef(tripId).collection("places")

export async function createPlace(
  user: SessionUser,
  tripId: string,
  input: CreatePlaceInput,
  source: Place["source"] = "manual",
): Promise<Place> {
  return firestore.runTransaction(async (tx) => {
    await requireTripAccess(tripId, user.id, "editor", tx)
    const ref = placesOf(tripId).doc()
    const now = nowIso()
    const place = Place.parse({
      ...input,
      id: ref.id,
      visited: false,
      source,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    })
    tx.set(ref, toFirestore(place))
    touchTrip(tx, tripId)
    return place
  })
}

export async function updatePlace(
  user: SessionUser,
  tripId: string,
  placeId: string,
  input: UpdatePlaceInput,
): Promise<Place> {
  return firestore.runTransaction(async (tx) => {
    await requireTripAccess(tripId, user.id, "editor", tx)
    const ref = placesOf(tripId).doc(placeId)
    const snap = await tx.get(ref)
    if (!snap.exists) throw notFound("Local")
    const current = readDoc(Place, snap)
    const now = nowIso()

    const next: Place = { ...current, ...stripUndefined(input), updatedAt: now }
    const update: Record<string, unknown> = { ...toFirestore(stripUndefined(input)), updatedAt: now }
    // An empty string clears an optional text field.
    for (const key of ["description", "address", "city", "googlePlaceId"] as const) {
      if (input[key] === "") {
        update[key] = FieldValue.delete()
        delete next[key]
      }
    }
    if (input.visited !== undefined && input.visited !== current.visited) {
      if (input.visited) {
        Object.assign(update, { visitedAt: now, visitedBy: user.id })
        Object.assign(next, { visitedAt: now, visitedBy: user.id })
      } else {
        Object.assign(update, { visitedAt: FieldValue.delete(), visitedBy: FieldValue.delete() })
        delete next.visitedAt
        delete next.visitedBy
      }
    }
    tx.update(ref, update)
    touchTrip(tx, tripId)
    return Place.parse(next)
  })
}

/** Deletes a Place and every Stop that references it, atomically. */
export async function deletePlace(user: SessionUser, tripId: string, placeId: string): Promise<void> {
  await firestore.runTransaction(async (tx) => {
    await requireTripAccess(tripId, user.id, "editor", tx)
    const ref = placesOf(tripId).doc(placeId)
    const [snap, daysSnap] = await Promise.all([tx.get(ref), tx.get(tripRef(tripId).collection("days"))])
    if (!snap.exists) throw notFound("Local")
    const now = nowIso()
    for (const doc of daysSnap.docs) {
      const day = readDoc(Day, doc)
      const stops = removePlace(day.stops, placeId)
      if (stops.length === day.stops.length) continue
      tx.update(doc.ref, { stops, version: day.version + 1, updatedAt: now, updatedBy: user.id })
    }
    tx.delete(ref)
    touchTrip(tx, tripId)
  })
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>
}
