"use client"

import { useState } from "react"
import { CalendarPlus, CheckCircle2, Circle, ExternalLink, MoreVertical, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { dayChipLabel, googleMapsPlaceUrl } from "@/lib/client/trip-view"
import { CATEGORY_LABELS } from "@/lib/domain/categories"
import type { Place } from "@/lib/domain/schemas"
import { cn } from "@/lib/utils"
import { useAddStop, useDeletePlace, useSetVisited } from "@/hooks/use-trip-mutations"
import { CategoryBadge } from "./category-badge"
import { PlaceEditor } from "./place-editor"
import { useTrip } from "./trip-context"

export function PlaceRow({ place }: { place: Place }) {
  const { tripId, detail, selectPlace, selectedPlaceId } = useTrip()
  const setVisited = useSetVisited(tripId)
  const addStop = useAddStop(tripId)
  const deletePlace = useDeletePlace(tripId)
  const [editing, setEditing] = useState(false)
  const dayCount = detail.days.filter((d) => d.stops.some((s) => s.placeId === place.id)).length

  return (
    <li
      className={cn(
        "bg-card flex items-center gap-1 rounded-xl border pr-1",
        selectedPlaceId === place.id && "border-primary",
      )}
    >
      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 p-2 text-left" onClick={() => selectPlace(place.id)}>
        <CategoryBadge category={place.category} visited={place.visited} />
        <span className="min-w-0">
          <span className={cn("block truncate font-medium", place.visited && "text-muted-foreground line-through")}>{place.name}</span>
          <span className="text-muted-foreground block truncate text-xs">
            {CATEGORY_LABELS[place.category]}
            {dayCount > 0 && ` · em ${dayCount} ${dayCount === 1 ? "dia" : "dias"}`}
          </span>
        </span>
      </button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={place.visited ? `Desmarcar ${place.name} como visitado` : `Marcar ${place.name} como visitado`}
        aria-pressed={place.visited}
        onClick={() => setVisited.mutate({ tripId, placeId: place.id, visited: !place.visited })}
      >
        {place.visited ? <CheckCircle2 className="text-success size-5" /> : <Circle className="size-5" />}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Ações para ${place.name}`}>
            <MoreVertical className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          {detail.days.length > 0 && (
            <>
              <DropdownMenuLabel className="text-muted-foreground text-xs">Adicionar ao dia</DropdownMenuLabel>
              {detail.days.map((d) => (
                <DropdownMenuItem key={d.id} onSelect={() => addStop.mutate({ dayId: d.id, placeId: place.id })}>
                  <CalendarPlus /> <span>{dayChipLabel(d.date)}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={googleMapsPlaceUrl(place)} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> Abrir no Google Maps
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              const msg = dayCount
                ? `Remover "${place.name}"? Ele também sai de ${dayCount} ${dayCount === 1 ? "dia" : "dias"} do roteiro.`
                : `Remover "${place.name}"?`
              if (confirm(msg)) deletePlace.mutate(place.id)
            }}
          >
            <Trash2 /> Remover da viagem
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {editing && <PlaceEditor place={place} open={editing} onOpenChange={setEditing} />}
    </li>
  )
}
