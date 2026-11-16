"use client"

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { Bike, Bus, Car, ExternalLink, Footprints, MoreVertical, Trash2, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { dayLongLabel, dayPath, googleMapsDayUrl } from "@/lib/client/trip-view"
import type { Day, TravelMode } from "@/lib/domain/schemas"
import { cn } from "@/lib/utils"
import { useDeleteDay, useEditStop, useUpdateDay } from "@/hooks/use-trip-mutations"
import { AddStopPicker } from "./add-stop-picker"
import { StopRow } from "./stop-row"
import { useTrip } from "./trip-context"

const MODES: { id: TravelMode; label: string; icon: LucideIcon }[] = [
  { id: "WALK", label: "A pé", icon: Footprints },
  { id: "BICYCLE", label: "Bike", icon: Bike },
  { id: "DRIVE", label: "Carro", icon: Car },
  { id: "TRANSIT", label: "Transporte", icon: Bus },
]

export function DayCard({ day, footer }: { day: Day; footer?: React.ReactNode }) {
  const { tripId, detail } = useTrip()
  const updateDay = useUpdateDay(tripId)
  const deleteDay = useDeleteDay(tripId)
  const editStop = useEditStop(tripId)
  const mapsUrl = googleMapsDayUrl(dayPath(detail, day), day.travelMode)

  // Long-press to drag on touch (so the list still scrolls), small distance for mouse,
  // and full keyboard support (space to lift, arrows to move).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const toIndex = day.stops.findIndex((s) => s.id === over.id)
    if (toIndex >= 0) editStop.mutate({ dayId: day.id, stopId: String(active.id), toIndex })
  }

  const nameOf = (id: string | number) => {
    const stop = day.stops.find((s) => s.id === id)
    return detail.places.find((p) => p.id === stop?.placeId)?.name ?? "parada"
  }

  return (
    <section className="space-y-3" aria-label={dayLongLabel(day.date)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{dayLongLabel(day.date)}</h2>
          <p className="text-muted-foreground text-sm">
            {day.stops.length} {day.stops.length === 1 ? "parada" : "paradas"}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Ações do dia">
              <MoreVertical className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {mapsUrl && (
              <DropdownMenuItem asChild>
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink /> Abrir rota no Google Maps
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                if (confirm("Excluir este dia? Os lugares continuam salvos na viagem.")) deleteDay.mutate(day.id)
              }}
            >
              <Trash2 /> Excluir dia
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div role="radiogroup" aria-label="Modo de deslocamento" className="bg-muted grid grid-cols-4 gap-1 rounded-xl p-1">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={day.travelMode === id}
            onClick={() => day.travelMode !== id && updateDay.mutate({ dayId: day.id, travelMode: id })}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-medium",
              day.travelMode === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {day.stops.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border-2 border-dashed p-6 text-center text-sm">
          Nenhuma parada neste dia ainda.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={{
            announcements: {
              onDragStart: ({ active }) => `${nameOf(active.id)} selecionada.`,
              onDragOver: ({ active, over }) => (over ? `${nameOf(active.id)} sobre ${nameOf(over.id)}.` : ""),
              onDragEnd: ({ active, over }) => (over ? `${nameOf(active.id)} movida.` : "Movimento cancelado."),
              onDragCancel: () => "Movimento cancelado.",
            },
            screenReaderInstructions: {
              draggable: "Pressione espaço para pegar a parada, setas para mover e espaço para soltar.",
            },
          }}
        >
          <SortableContext items={day.stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ol className="space-y-2">
              {day.stops.map((stop, i) => (
                <StopRow key={stop.id} dayId={day.id} stop={stop} index={i} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <AddStopPicker dayId={day.id} />
      {footer}
    </section>
  )
}
