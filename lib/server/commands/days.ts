import "server-only"
import type { Transaction } from "firebase-admin/firestore"
import { nanoid } from "nanoid"
import { conflict, notFound } from "@/lib/domain/errors"
import {
  Day,
  type AddStopInput,
  type CreateDayInput,
  type Stop,
  type UpdateDayInput,
  type UpdateStopInput,
} from "@/lib/domain/schemas"
import { applyOrder, insertStop, moveStop, removeStop, updateStop } from "@/lib/domain/stops"
import { requireTripAccess, tripRef, type SessionUser } from "../authz"
import { firestore } from "../firebase"
import { nowIso, readDoc, toFirestore } from "../firestore-io"
import { touchTrip } from "./trips"

// ADR-0001: Stops live in an array on the Day document. Every change is an
// operation applied inside a transaction (never "replace with the client's copy"),
// and `version` increments on each change so whole-order replacements can detect
// staleness (409).

const daysOf = (tripId: string) => tripRef(tripId).collection("days")

async function assertUniqueDate(tx: Transaction, tripId: string, date: string, exceptDayId?: string) {
  const same = await tx.get(daysOf(tripId).where("date", "==", date))
  if (same.docs.some((d) => d.id !== exceptDayId)) throw conflict("Já existe um dia com esta data")
}

async function readDay(tx: Transaction, tripId: string, dayId: string) {
  const ref = daysOf(tripId).doc(dayId)
  const snap = await tx.get(ref)
  if (!snap.exists) throw notFound("Dia")
  return { ref, day: readDoc(Day, snap) }
}

export async function createDay(user: SessionUser, tripId: string, input: CreateDayInput): Promise<Day> {
  return firestore.runTransaction(async (tx) => {
    await requireTripAccess(tripId, user.id, "editor", tx)
    await assertUniqueDate(tx, tripId, input.date)
    const ref = daysOf(tripId).doc()
    const now = nowIso()
    const day = Day.parse({
      id: ref.id,
      date: input.date,
      travelMode: input.travelMode ?? "WALK",
      stops: [],
      version: 0,
      route: null,
      createdAt: now,
      updatedAt: now,
      updatedBy: user.id,
    })
    tx.set(ref, toFirestore(day))
    touchTrip(tx, tripId)
    return day
  })
}

export async function updateDay(user: SessionUser, tripId: string, dayId: string, input: UpdateDayInput): Promise<Day> {
  return firestore.runTransaction(async (tx) => {
    await requireTripAccess(tripId, user.id, "editor", tx)
    const { ref, day } = await readDay(tx, tripId, dayId)
    if (input.date && input.date !== day.date) await assertUniqueDate(tx, tripId, input.date, dayId)
    // A travelMode change keeps the stored Route; it is detected as stale by its travelMode.
    const next = Day.parse({
      ...day,
      ...(input.date ? { date: input.date } : {}),
      ...(input.travelMode ? { travelMode: input.travelMode } : {}),
      version: day.version + 1,
      updatedAt: nowIso(),
      updatedBy: user.id,
    })
    tx.update(ref, toFirestore(next))
    touchTrip(tx, tripId)
    return next
  })
}

export async function deleteDay(user: SessionUser, tripId: string, dayId: string): Promise<void> {
  await firestore.runTransaction(async (tx) => {
    await requireTripAccess(tripId, user.id, "editor", tx)
    const { ref } = await readDay(tx, tripId, dayId)
    tx.delete(ref)
    touchTrip(tx, tripId)
  })
}

/** Applies a pure Stop-list operation to one Day inside a transaction. */
async function mutateStops(
  user: SessionUser,
  tripId: string,
  dayId: string,
  op: (stops: Stop[], tx: Transaction) => Promise<Stop[]> | Stop[],
  expectedVersion?: number,
): Promise<Day> {
  return firestore.runTransaction(async (tx) => {
    await requireTripAccess(tripId, user.id, "editor", tx)
    const { ref, day } = await readDay(tx, tripId, dayId)
    if (expectedVersion !== undefined && expectedVersion !== day.version) {
      throw conflict("Alguém editou este dia. Atualize e tente novamente.")
    }
    const stops = await op(day.stops, tx)
    const next = Day.parse({ ...day, stops, version: day.version + 1, updatedAt: nowIso(), updatedBy: user.id })
    tx.update(ref, { stops: next.stops, version: next.version, updatedAt: next.updatedAt, updatedBy: user.id })
    touchTrip(tx, tripId)
    return next
  })
}

export function addStop(user: SessionUser, tripId: string, dayId: string, input: AddStopInput): Promise<Day> {
  return mutateStops(user, tripId, dayId, async (stops, tx) => {
    const place = await tx.get(tripRef(tripId).collection("places").doc(input.placeId))
    if (!place.exists) throw notFound("Local")
    return insertStop(stops, { id: nanoid(12), placeId: input.placeId }, input.index)
  })
}

export function removeStopFromDay(user: SessionUser, tripId: string, dayId: string, stopId: string): Promise<Day> {
  return mutateStops(user, tripId, dayId, (stops) => removeStop(stops, stopId))
}

export function reorderStops(
  user: SessionUser,
  tripId: string,
  dayId: string,
  stopIds: string[],
  expectedVersion: number,
): Promise<Day> {
  return mutateStops(user, tripId, dayId, (stops) => applyOrder(stops, stopIds), expectedVersion)
}

/**
 * Edits a Stop's details and/or moves it — within the Day (`toIndex`) or to
 * another Day (`toDayId`, appended or at `toIndex`). Returns the affected Days.
 */
export async function editStop(
  user: SessionUser,
  tripId: string,
  dayId: string,
  stopId: string,
  input: UpdateStopInput,
): Promise<Day[]> {
  const { toIndex, toDayId, ...details } = input
  if (!toDayId || toDayId === dayId) {
    const day = await mutateStops(user, tripId, dayId, (stops) => {
      let next = updateStop(stops, stopId, details)
      if (toIndex !== undefined) next = moveStop(next, stopId, toIndex)
      return next
    })
    return [day]
  }

  return firestore.runTransaction(async (tx) => {
    await requireTripAccess(tripId, user.id, "editor", tx)
    const [from, to] = await Promise.all([readDay(tx, tripId, dayId), readDay(tx, tripId, toDayId)])
    const updated = updateStop(from.day.stops, stopId, details)
    const stop = updated.find((s) => s.id === stopId)!
    const now = nowIso()
    const fromNext = Day.parse({
      ...from.day,
      stops: removeStop(updated, stopId),
      version: from.day.version + 1,
      updatedAt: now,
      updatedBy: user.id,
    })
    const toNext = Day.parse({
      ...to.day,
      stops: insertStop(to.day.stops, stop, toIndex),
      version: to.day.version + 1,
      updatedAt: now,
      updatedBy: user.id,
    })
    for (const [ref, d] of [
      [from.ref, fromNext],
      [to.ref, toNext],
    ] as const) {
      tx.update(ref, { stops: d.stops, version: d.version, updatedAt: now, updatedBy: user.id })
    }
    touchTrip(tx, tripId)
    return [fromNext, toNext]
  })
}
