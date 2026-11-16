import "server-only"
import { conflict, notFound, validation } from "@/lib/domain/errors"
import { canOptimize } from "@/lib/domain/route"
import { Day, Place, Route, type TravelMode } from "@/lib/domain/schemas"
import { applyOrder, stopIdsKey } from "@/lib/domain/stops"
import { requireTripAccess, tripRef, type SessionUser } from "../authz"
import { firestore } from "../firebase"
import { nowIso, readDoc } from "../firestore-io"
import { computeRoute, type ComputedRoute, type LatLng } from "../maps/routes-api"

// Routes are computed OUTSIDE the transaction (network call), then written inside
// one that re-checks the Day still has the same Stops/version (ADR-0001).

async function loadDay(user: SessionUser, tripId: string, dayId: string) {
  const { ref } = await requireTripAccess(tripId, user.id, "editor")
  const [daySnap, placesSnap] = await Promise.all([ref.collection("days").doc(dayId).get(), ref.collection("places").get()])
  if (!daySnap.exists) throw notFound("Dia")
  const day = readDoc(Day, daySnap)
  const places = new Map(placesSnap.docs.map((d) => [d.id, readDoc(Place, d)]))
  const points: LatLng[] = day.stops.map((s) => {
    const p = places.get(s.placeId)
    if (!p) throw conflict("Uma parada aponta para um lugar removido. Atualize a página.")
    return p.location
  })
  return { day, points }
}

function toRoute(computed: ComputedRoute, mode: TravelMode, key: string): Route {
  return Route.parse({
    travelMode: mode,
    stopIdsKey: key,
    encodedPolyline: computed.encodedPolyline,
    distanceMeters: computed.distanceMeters,
    durationSec: computed.durationSec,
    legs: computed.legs,
    computedAt: nowIso(),
    warnings: computed.warnings,
  })
}

/** Computes the Day's Route in its current order and travel mode, and stores it. */
export async function computeDayRoute(user: SessionUser, tripId: string, dayId: string): Promise<Day> {
  const { day, points } = await loadDay(user, tripId, dayId)
  if (points.length < 2) throw validation("Adicione pelo menos 2 paradas para calcular o percurso.")
  const key = stopIdsKey(day.stops)
  const route = toRoute(await computeRoute(points, day.travelMode), day.travelMode, key)

  return firestore.runTransaction(async (tx) => {
    await requireTripAccess(tripId, user.id, "editor", tx)
    const ref = tripRef(tripId).collection("days").doc(dayId)
    const snap = await tx.get(ref)
    if (!snap.exists) throw notFound("Dia")
    const current = readDoc(Day, snap)
    if (stopIdsKey(current.stops) !== key || current.travelMode !== day.travelMode) {
      throw conflict("O dia mudou enquanto o percurso era calculado. Tente de novo.")
    }
    tx.update(ref, { route, updatedAt: nowIso(), updatedBy: user.id })
    return { ...current, route }
  })
}

/**
 * Reorders the Day's intermediate Stops for the shortest Route (first and last stay)
 * and stores both. Returns the previous order so the client can offer Undo.
 */
export async function optimizeDay(
  user: SessionUser,
  tripId: string,
  dayId: string,
  expectedVersion: number,
): Promise<{ day: Day; previousStopIds: string[] }> {
  const { day, points } = await loadDay(user, tripId, dayId)
  if (day.version !== expectedVersion) throw conflict("Alguém editou este dia. Atualize e tente novamente.")
  const check = canOptimize(day)
  if (!check.ok) throw validation(check.reason)

  const computed = await computeRoute(points, day.travelMode, { optimize: true })
  const middle = day.stops.slice(1, -1)
  const order = computed.optimizedIntermediateOrder?.length === middle.length ? computed.optimizedIntermediateOrder : middle.map((_, i) => i)
  const newIds = [day.stops[0].id, ...order.map((i) => middle[i].id), day.stops[day.stops.length - 1].id]
  const previousStopIds = day.stops.map((s) => s.id)

  return firestore.runTransaction(async (tx) => {
    await requireTripAccess(tripId, user.id, "editor", tx)
    const ref = tripRef(tripId).collection("days").doc(dayId)
    const snap = await tx.get(ref)
    if (!snap.exists) throw notFound("Dia")
    const current = readDoc(Day, snap)
    if (current.version !== expectedVersion) throw conflict("Alguém editou este dia. Atualize e tente novamente.")
    const stops = applyOrder(current.stops, newIds)
    const route = toRoute(computed, current.travelMode, stopIdsKey(stops))
    const next = Day.parse({ ...current, stops, route, version: current.version + 1, updatedAt: nowIso(), updatedBy: user.id })
    tx.update(ref, { stops: next.stops, route: next.route, version: next.version, updatedAt: next.updatedAt, updatedBy: user.id })
    return { day: next, previousStopIds }
  })
}

/** A walking/cycling Route for GPX export only — never stored, the Day's mode is untouched. */
export async function exportRoute(user: SessionUser, tripId: string, dayId: string, mode: "WALK" | "BICYCLE"): Promise<Route> {
  const { day, points } = await loadDay(user, tripId, dayId)
  if (points.length < 2) throw validation("Adicione pelo menos 2 paradas para exportar o percurso.")
  return toRoute(await computeRoute(points, mode), mode, stopIdsKey(day.stops))
}
