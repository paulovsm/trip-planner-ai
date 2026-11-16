import { format, isBefore, parseISO, startOfDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { TripDetail } from "@/lib/domain/dto"
import type { Day, Place } from "@/lib/domain/schemas"

// Pure view-model helpers for the trip screen.

export type MapPin = {
  key: string
  name: string
  category: Place["category"]
  lat: number
  lng: number
  visited: boolean
  order?: number
}

/** Map pins for every Place; Places in the selected Day carry their 1-based order. */
export function mapPins(detail: TripDetail, day?: Day | null): MapPin[] {
  const order = new Map<string, number>()
  day?.stops.forEach((s, i) => {
    if (!order.has(s.placeId)) order.set(s.placeId, i + 1)
  })
  return detail.places.map((p) => ({
    key: p.id,
    name: p.name,
    category: p.category,
    lat: p.location.lat,
    lng: p.location.lng,
    visited: p.visited,
    order: order.get(p.id),
  }))
}

/** Ordered coordinates of a Day's Stops (skipping Stops whose Place is gone). */
export function dayPath(detail: TripDetail, day?: Day | null): { lat: number; lng: number }[] {
  if (!day) return []
  const byId = new Map(detail.places.map((p) => [p.id, p]))
  return day.stops.flatMap((s) => {
    const p = byId.get(s.placeId)
    return p ? [p.location] : []
  })
}

/** The Day to show by default: today if it exists, else the next upcoming, else the first. */
export function defaultDay(days: Day[], today = new Date()): Day | undefined {
  const t = format(today, "yyyy-MM-dd")
  return days.find((d) => d.date === t) ?? days.find((d) => d.date > t) ?? days[0]
}

export const isPastDay = (date: string, today = new Date()) => isBefore(parseISO(date), startOfDay(today))

const capitalizeFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "Qui 3/12" */
export const dayChipLabel = (date: string) => capitalizeFirst(format(parseISO(date), "EEE d/M", { locale: ptBR }))
/** "Quinta-feira, 3 de dezembro" (only the first letter capitalized, as in Portuguese) */
export const dayLongLabel = (date: string) => capitalizeFirst(format(parseISO(date), "EEEE, d 'de' MMMM", { locale: ptBR }))

export function tripDatesLabel(start?: string, end?: string): string {
  if (!start) return "Datas a definir"
  const s = parseISO(start)
  if (!end || end === start) return format(s, "d 'de' MMM yyyy", { locale: ptBR })
  const e = parseISO(end)
  const sameYear = s.getFullYear() === e.getFullYear()
  return `${format(s, sameYear ? "d MMM" : "d MMM yyyy", { locale: ptBR })} – ${format(e, "d MMM yyyy", { locale: ptBR })}`
}

/** Google Maps directions deep link for a Day, in its travel mode. */
export function googleMapsDayUrl(path: { lat: number; lng: number }[], mode: Day["travelMode"]): string | null {
  if (path.length < 2) return null
  const fmt = (p: { lat: number; lng: number }) => `${p.lat},${p.lng}`
  const travelmode = { WALK: "walking", BICYCLE: "bicycling", DRIVE: "driving", TRANSIT: "transit" }[mode]
  const url = new URL("https://www.google.com/maps/dir/")
  url.searchParams.set("api", "1")
  url.searchParams.set("origin", fmt(path[0]))
  url.searchParams.set("destination", fmt(path[path.length - 1]))
  url.searchParams.set("travelmode", travelmode)
  if (path.length > 2) url.searchParams.set("waypoints", path.slice(1, -1).map(fmt).join("|"))
  return url.toString()
}

export const googleMapsPlaceUrl = (p: Pick<Place, "name" | "location" | "googlePlaceId">) => {
  const url = new URL("https://www.google.com/maps/search/")
  url.searchParams.set("api", "1")
  url.searchParams.set("query", `${p.location.lat},${p.location.lng}`)
  if (p.googlePlaceId) url.searchParams.set("query_place_id", p.googlePlaceId)
  return url.toString()
}
