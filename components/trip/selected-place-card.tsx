"use client"

import { CalendarPlus, CheckCircle2, Circle, ExternalLink, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { dayChipLabel, googleMapsPlaceUrl } from "@/lib/client/trip-view"
import { CATEGORY_LABELS } from "@/lib/domain/categories"
import { cn } from "@/lib/utils"
import { useAddStop, useSetVisited } from "@/hooks/use-trip-mutations"
import { CategoryBadge } from "./category-badge"
import { useTrip } from "./trip-context"

/** Floating card for the Place selected on the map. */
export function SelectedPlaceCard({ className }: { className?: string }) {
  const { tripId, placesById, selectedPlaceId, selectPlace, selectedDay } = useTrip()
  const setVisited = useSetVisited(tripId)
  const addStop = useAddStop(tripId)
  const place = selectedPlaceId ? placesById.get(selectedPlaceId) : undefined
  if (!place) return null
  const inDay = selectedDay?.stops.some((s) => s.placeId === place.id)

  return (
    <div className={cn("bg-background rounded-2xl border p-3 shadow-lg", className)} role="dialog" aria-label={place.name}>
      <div className="flex items-start gap-3">
        <CategoryBadge category={place.category} visited={place.visited} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{place.name}</p>
          <p className="text-muted-foreground truncate text-xs">
            {CATEGORY_LABELS[place.category]}
            {place.address ? ` · ${place.address}` : place.city ? ` · ${place.city}` : ""}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Fechar" onClick={() => selectPlace(null)}>
          <X className="size-5" />
        </Button>
      </div>
      {place.description && <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">{place.description}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setVisited.mutate({ tripId, placeId: place.id, visited: !place.visited })}
          aria-pressed={place.visited}
        >
          {place.visited ? <CheckCircle2 className="text-success" /> : <Circle />} {place.visited ? "Visitado" : "Marcar visitado"}
        </Button>
        {selectedDay && !inDay && (
          <Button variant="outline" size="sm" onClick={() => addStop.mutate({ dayId: selectedDay.id, placeId: place.id })}>
            <CalendarPlus /> <span>{dayChipLabel(selectedDay.date)}</span>
          </Button>
        )}
        <Button asChild variant="ghost" size="sm">
          <a href={googleMapsPlaceUrl(place)} target="_blank" rel="noopener noreferrer">
            <ExternalLink /> Maps
          </a>
        </Button>
      </div>
    </div>
  )
}
