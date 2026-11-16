"use client"

import { useState } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Circle, CheckCircle2, Clock, ExternalLink, GripVertical, MoreVertical, NotebookPen, Pencil, Trash2, CalendarArrowUp } from "lucide-react"
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
import { formatDistance, formatDuration, type StopEta } from "@/lib/domain/route"
import type { Stop, TravelMode } from "@/lib/domain/schemas"
import { cn } from "@/lib/utils"
import { useEditStop, useRemoveStop, useSetVisited } from "@/hooks/use-trip-mutations"
import { CategoryBadge } from "./category-badge"
import { StopEditor } from "./stop-editor"
import { useTrip } from "./trip-context"

const MODE_VERB: Record<TravelMode, string> = { WALK: "a pé", BICYCLE: "de bike", DRIVE: "de carro", TRANSIT: "de transporte" }

export function StopRow({
  dayId,
  stop,
  index,
  eta,
  mode,
}: {
  dayId: string
  stop: Stop
  index: number
  eta?: StopEta
  mode: TravelMode
}) {
  const { tripId, detail, placesById, selectPlace, selectedPlaceId } = useTrip()
  const place = placesById.get(stop.placeId)
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: stop.id,
  })
  const setVisited = useSetVisited(tripId)
  const removeStop = useRemoveStop(tripId)
  const editStop = useEditStop(tripId)
  const [editing, setEditing] = useState(false)

  if (!place) return null
  const otherDays = detail.days.filter((d) => d.id !== dayId)
  const meta = [
    eta ? `chega ${eta.eta}${eta.nextDay ? " (+1 dia)" : ""}` : stop.time,
    eta && stop.time && eta.eta !== stop.time ? `plano ${stop.time}` : null,
    stop.durationMin ? `fica ${stop.durationMin} min` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "bg-card flex items-center gap-1 rounded-xl border pr-1",
        isDragging && "relative z-10 shadow-lg",
        selectedPlaceId === place.id && "border-primary",
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="text-muted-foreground flex h-14 w-9 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
        aria-label={`Arrastar ${place.name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-5" />
      </button>
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left"
        onClick={() => selectPlace(place.id)}
      >
        <CategoryBadge category={place.category} visited={place.visited} number={index + 1} />
        <span className="min-w-0">
          <span className={cn("block truncate font-medium", place.visited && "text-muted-foreground line-through")}>
            {place.name}
          </span>
          <span className="text-muted-foreground flex items-center gap-1 truncate text-xs">
            {meta ? (
              <>
                <Clock className={cn("size-3", eta?.late && "text-destructive")} /> {meta}
                {eta?.late && <span className="text-destructive"> · atrasado</span>}
              </>
            ) : (
              CATEGORY_LABELS[place.category]
            )}
            {stop.notes && <NotebookPen className="ml-1 size-3" aria-label="Tem notas" />}
          </span>
          {eta?.legBefore && (
            <span className="text-muted-foreground block text-[11px]">
              {formatDuration(eta.legBefore.durationSec)} {MODE_VERB[mode]} · {formatDistance(eta.legBefore.distanceMeters)} desde a anterior
            </span>
          )}
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
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil /> Horário e notas
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={googleMapsPlaceUrl(place)} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> Abrir no Google Maps
            </a>
          </DropdownMenuItem>
          {otherDays.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-muted-foreground text-xs">Mover para</DropdownMenuLabel>
              {otherDays.map((d) => (
                <DropdownMenuItem key={d.id} onSelect={() => editStop.mutate({ dayId, stopId: stop.id, toDayId: d.id })}>
                  <CalendarArrowUp /> <span>{dayChipLabel(d.date)}</span>
                </DropdownMenuItem>
              ))}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => removeStop.mutate({ dayId, stopId: stop.id })}>
            <Trash2 /> Remover do dia
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {editing && <StopEditor dayId={dayId} stop={stop} open={editing} onOpenChange={setEditing} />}
    </li>
  )
}
