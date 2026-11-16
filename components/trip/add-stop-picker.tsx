"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { PlaceSearch, type PickedPlace } from "@/components/places/place-search"
import { CATEGORY_LABELS } from "@/lib/domain/categories"
import { useAddStop, useCreatePlace } from "@/hooks/use-trip-mutations"
import { CategoryBadge } from "./category-badge"
import { useTrip } from "./trip-context"

/** Adds a Stop to a Day: pick one of the Trip's Places, or find a new one on Google. */
export function AddStopPicker({ dayId }: { dayId: string }) {
  const { tripId, detail } = useTrip()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"trip" | "google">("trip")
  const addStop = useAddStop(tripId)
  const createPlace = useCreatePlace(tripId)
  const inDay = new Set(detail.days.find((d) => d.id === dayId)?.stops.map((s) => s.placeId))
  const bias = detail.places[0]?.location

  const addExisting = (placeId: string) => {
    addStop.mutate({ dayId, placeId })
    setOpen(false)
  }

  const addNew = async (picked: PickedPlace) => {
    const existing = detail.places.find((p) => p.googlePlaceId && p.googlePlaceId === picked.googlePlaceId)
    if (existing) return addExisting(existing.id)
    const place = await createPlace.mutateAsync(picked)
    addExisting(place.id)
  }

  return (
    <>
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <Plus /> Adicionar parada
      </Button>
      <ResponsiveDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) setMode("trip")
        }}
        title="Adicionar parada"
      >
        <div className="mb-3 grid grid-cols-2 gap-2" role="tablist">
          <Button variant={mode === "trip" ? "secondary" : "ghost"} role="tab" aria-selected={mode === "trip"} onClick={() => setMode("trip")}>
            Lugares da viagem
          </Button>
          <Button variant={mode === "google" ? "secondary" : "ghost"} role="tab" aria-selected={mode === "google"} onClick={() => setMode("google")}>
            Buscar novo
          </Button>
        </div>
        {mode === "trip" ? (
          <Command className="border">
            <CommandInput placeholder="Filtrar lugares…" />
            <CommandList>
              <CommandEmpty>
                Nenhum lugar.{" "}
                <button type="button" className="text-primary underline" onClick={() => setMode("google")}>
                  Buscar no Google
                </button>
              </CommandEmpty>
              <CommandGroup>
                {detail.places.map((p) => (
                  <CommandItem key={p.id} value={`${p.name} ${p.city ?? ""}`} onSelect={() => addExisting(p.id)}>
                    <CategoryBadge category={p.category} visited={p.visited} className="size-7" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{p.name}</div>
                      <div className="text-muted-foreground truncate text-xs">
                        {CATEGORY_LABELS[p.category]}
                        {p.city && ` · ${p.city}`}
                        {inDay.has(p.id) && " · já neste dia"}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <PlaceSearch onPick={addNew} bias={bias} autoFocus />
        )}
      </ResponsiveDialog>
    </>
  )
}
