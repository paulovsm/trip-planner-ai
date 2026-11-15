import { conflict, notFound, validation } from "./errors"
import { MAX_STOPS_PER_DAY, type Stop } from "./schemas"

// Pure operations on a Day's ordered Stop list. Position = array index (no "order" field).
// Server commands apply these inside a Firestore transaction (ADR-0001).

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max)

function indexOf(stops: readonly Stop[], stopId: string): number {
  const i = stops.findIndex((s) => s.id === stopId)
  if (i === -1) throw notFound("Parada")
  return i
}

/** Inserts a Stop at `index` (default: end). */
export function insertStop(stops: readonly Stop[], stop: Stop, index = stops.length): Stop[] {
  if (stops.length >= MAX_STOPS_PER_DAY) {
    throw validation(`Um dia pode ter no máximo ${MAX_STOPS_PER_DAY} paradas`)
  }
  if (stops.some((s) => s.id === stop.id)) throw conflict("Parada duplicada")
  const next = [...stops]
  next.splice(clamp(index, 0, stops.length), 0, stop)
  return next
}

/** Moves a Stop to `toIndex` (clamped), keeping every other Stop's relative order. */
export function moveStop(stops: readonly Stop[], stopId: string, toIndex: number): Stop[] {
  const from = indexOf(stops, stopId)
  const next = [...stops]
  const [stop] = next.splice(from, 1)
  next.splice(clamp(toIndex, 0, next.length), 0, stop)
  return next
}

export function removeStop(stops: readonly Stop[], stopId: string): Stop[] {
  indexOf(stops, stopId)
  return stops.filter((s) => s.id !== stopId)
}

export function updateStop(
  stops: readonly Stop[],
  stopId: string,
  patch: { time?: string | null; durationMin?: number | null; notes?: string | null },
): Stop[] {
  const i = indexOf(stops, stopId)
  const stop: Stop = { ...stops[i] }
  for (const key of ["time", "durationMin", "notes"] as const) {
    if (!(key in patch)) continue
    const value = patch[key]
    if (value === null || value === "") delete stop[key]
    else (stop as Record<string, unknown>)[key] = value
  }
  const next = [...stops]
  next[i] = stop
  return next
}

/**
 * Applies a full ordering (used by Optimize and Undo). `stopIds` must be a
 * permutation of the current Stops; anything else means the client is stale.
 */
export function applyOrder(stops: readonly Stop[], stopIds: readonly string[]): Stop[] {
  const byId = new Map(stops.map((s) => [s.id, s]))
  const isPermutation =
    stopIds.length === stops.length && new Set(stopIds).size === stopIds.length && stopIds.every((id) => byId.has(id))
  if (!isPermutation) throw conflict("A lista de paradas mudou. Atualize e tente novamente.")
  return stopIds.map((id) => byId.get(id)!)
}

/** Removes every Stop that references `placeId` (used when a Place is deleted). */
export function removePlace(stops: readonly Stop[], placeId: string): Stop[] {
  return stops.filter((s) => s.placeId !== placeId)
}

/** Key identifying the Stop sequence a Route was computed for. */
export const stopIdsKey = (stops: readonly Stop[]) => stops.map((s) => s.id).join(",")
