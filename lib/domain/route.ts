import type { Day, Route } from "./schemas"
import { stopIdsKey } from "./stops"

// Pure rules for Routes (Percursos), shared by server and client.

export const MAX_OPTIMIZE_STOPS = 27 // Routes API: up to 25 intermediates + origin + destination

/** A Route is stale when the Stops or the travel mode changed since it was computed. */
export function isRouteStale(day: Pick<Day, "stops" | "travelMode" | "route">): boolean {
  return !day.route || day.route.stopIdsKey !== stopIdsKey(day.stops) || day.route.travelMode !== day.travelMode
}

export type OptimizeCheck = { ok: true } | { ok: false; reason: string }

export function canOptimize(day: Pick<Day, "stops" | "travelMode">): OptimizeCheck {
  if (day.travelMode === "TRANSIT") return { ok: false, reason: "Otimizar não está disponível para transporte público." }
  if (day.stops.length < 3) return { ok: false, reason: "Otimizar precisa de pelo menos 3 paradas." }
  if (day.stops.length > MAX_OPTIMIZE_STOPS) return { ok: false, reason: `Otimizar aceita até ${MAX_OPTIMIZE_STOPS} paradas.` }
  return { ok: true }
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}
const toHHmm = (minutes: number) => {
  const m = Math.round(minutes) % (24 * 60)
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

export type StopEta = {
  /** Estimated arrival "HH:mm". */
  eta: string
  /** Arrival later than the Stop's planned time. */
  late: boolean
  /** Travel from the previous Stop (undefined for the first). */
  legBefore?: { distanceMeters: number; durationSec: number }
  /** True when the arrival is past midnight. */
  nextDay: boolean
}

/**
 * Arrival estimates for each Stop: start at the first Stop's time (default 09:00),
 * then add each Stop's duration and the following leg. A planned time later than
 * the estimate wins (you wait); an earlier one is flagged as late.
 */
export function computeEtas(day: Pick<Day, "stops" | "travelMode" | "route">, defaultStart = "09:00"): StopEta[] | null {
  const route = day.route
  if (!route || isRouteStale(day) || route.legs.length !== Math.max(0, day.stops.length - 1)) return null
  const out: StopEta[] = []
  let clock = 0
  day.stops.forEach((stop, i) => {
    const leg = i > 0 ? route.legs[i - 1] : undefined
    const arrival = i === 0 ? toMinutes(stop.time ?? defaultStart) : clock + (leg!.durationSec / 60)
    const planned = stop.time ? toMinutes(stop.time) : undefined
    const effective = planned !== undefined && planned > arrival ? planned : arrival
    out.push({
      eta: toHHmm(arrival),
      late: planned !== undefined && arrival > planned + 5,
      legBefore: leg,
      nextDay: arrival >= 24 * 60,
    })
    clock = effective + (stop.durationMin ?? 0)
  })
  return out
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0).replace(".", ",")} km`
}

export function formatDuration(seconds: number): string {
  const min = Math.max(1, Math.round(seconds / 60))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

export const routeSummary = (route: Pick<Route, "distanceMeters" | "durationSec">) =>
  `${formatDistance(route.distanceMeters)} · ${formatDuration(route.durationSec)}`
