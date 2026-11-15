import type { TripDetail } from "@/lib/domain/dto"
import { CATEGORY_LABELS } from "@/lib/domain/categories"
import type { Day, Place, TravelMode } from "@/lib/domain/schemas"

// TEMPORARY (F1 → F2): adapts the new Trip → Day → Stop → Place model to the props
// of the pre-F2 components (which still speak "Point/Itinerary"). F2 rewrites those
// components on the domain types and deletes this file.

export type LegacyPoint = {
  id: string
  name: string
  description: string | null
  category: string | null
  categoryKey: Place["category"]
  address: string | null
  city: string | null
  latitude: number
  longitude: number
  visited: boolean
}

export type LegacyItem = { id: string; point: LegacyPoint; order: number }

export type LegacyItinerary = {
  id: string
  date: string
  travelMode: TravelMode
  version: number
  items: LegacyItem[]
}

export const toLegacyPoint = (p: Place): LegacyPoint => ({
  id: p.id,
  name: p.name,
  description: p.description ?? null,
  category: CATEGORY_LABELS[p.category],
  categoryKey: p.category,
  address: p.address ?? null,
  city: p.city ?? null,
  latitude: p.location.lat,
  longitude: p.location.lng,
  visited: p.visited,
})

export function toLegacyItinerary(day: Day, points: Map<string, LegacyPoint>): LegacyItinerary {
  return {
    id: day.id,
    date: day.date,
    travelMode: day.travelMode,
    version: day.version,
    items: day.stops.flatMap((s, i) => {
      const point = points.get(s.placeId)
      return point ? [{ id: s.id, point, order: i }] : []
    }),
  }
}

export function toLegacyTrip(detail: TripDetail) {
  const points = detail.places.map(toLegacyPoint)
  const byId = new Map(points.map((p) => [p.id, p]))
  return {
    ...detail.trip,
    role: detail.role,
    points,
    itineraries: detail.days.map((d) => toLegacyItinerary(d, byId)),
  }
}

export type LegacyTrip = ReturnType<typeof toLegacyTrip>
