"use client"

import { useId, useState } from "react"
import { MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { Textarea } from "@/components/ui/textarea"
import { PlaceSearch, type PickedPlace } from "@/components/places/place-search"
import { CATEGORY_LABELS, PLACE_CATEGORIES, type PlaceCategory } from "@/lib/domain/categories"
import type { Place } from "@/lib/domain/schemas"
import { useCreatePlace, useUpdatePlace } from "@/hooks/use-trip-mutations"
import { useTrip } from "./trip-context"

type Draft = {
  name: string
  category: PlaceCategory
  city: string
  address: string
  description: string
  location?: { lat: number; lng: number }
  googlePlaceId?: string
}

const fromPlace = (p: Place): Draft => ({
  name: p.name,
  category: p.category,
  city: p.city ?? "",
  address: p.address ?? "",
  description: p.description ?? "",
  location: p.location,
  googlePlaceId: p.googlePlaceId,
})

/** Create (search on Google first) or edit a Place. Location only comes from Google results. */
export function PlaceEditor({
  place,
  open,
  onOpenChange,
  onCreated,
}: {
  place?: Place
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated?: (place: Place) => void
}) {
  const { tripId, detail } = useTrip()
  const id = useId()
  const [draft, setDraft] = useState<Draft | null>(place ? fromPlace(place) : null)
  const [relocating, setRelocating] = useState(false)
  const create = useCreatePlace(tripId)
  const update = useUpdatePlace(tripId)
  const bias = detail.places[0]?.location

  const onPick = (p: PickedPlace) => {
    setDraft((d) => ({
      name: d && place ? d.name : p.name,
      category: d && place ? d.category : p.category,
      city: p.city ?? "",
      address: p.address ?? "",
      description: d?.description ?? "",
      location: p.location,
      googlePlaceId: p.googlePlaceId,
    }))
    setRelocating(false)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft?.location || !draft.name.trim()) return
    const input = {
      name: draft.name.trim(),
      category: draft.category,
      city: draft.city.trim(),
      address: draft.address.trim(),
      description: draft.description.trim(),
      location: draft.location,
      googlePlaceId: draft.googlePlaceId ?? "",
    }
    if (place) {
      update.mutate({ placeId: place.id, input }, { onSuccess: () => onOpenChange(false) })
    } else {
      const strip = <T extends Record<string, unknown>>(o: T) =>
        Object.fromEntries(Object.entries(o).filter(([, v]) => v !== "")) as T
      const created = await create.mutateAsync(strip(input))
      onCreated?.(created)
      onOpenChange(false)
      setDraft(null)
    }
  }

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setDraft((d) => (d ? { ...d, [k]: e.target.value } : d))

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={place ? "Editar lugar" : "Adicionar lugar"}>
      {!draft || relocating ? (
        <div className="space-y-3">
          <PlaceSearch onPick={onPick} bias={bias} autoFocus />
          {relocating && (
            <Button variant="ghost" className="w-full" onClick={() => setRelocating(false)}>
              Cancelar
            </Button>
          )}
        </div>
      ) : (
        <form onSubmit={save} className="space-y-4">
          <div className="bg-muted flex items-start gap-2 rounded-lg p-3 text-sm">
            <MapPin className="text-primary mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate">{draft.address || draft.city || "Localização definida"}</p>
              <button type="button" className="text-primary text-xs underline" onClick={() => setRelocating(true)}>
                Trocar local no mapa
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-name`}>Nome</Label>
            <Input id={`${id}-name`} value={draft.name} onChange={set("name")} required maxLength={200} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`${id}-cat`}>Categoria</Label>
              <select
                id={`${id}-cat`}
                value={draft.category}
                onChange={set("category")}
                className="border-input bg-transparent dark:bg-input/30 h-9 w-full rounded-md border px-3 text-sm pointer-coarse:h-11"
              >
                {PLACE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-city`}>Cidade</Label>
              <Input id={`${id}-city`} value={draft.city} onChange={set("city")} maxLength={120} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-desc`}>Descrição</Label>
            <Textarea id={`${id}-desc`} value={draft.description} onChange={set("description")} maxLength={2000} />
          </div>
          <Button type="submit" className="w-full" disabled={create.isPending || update.isPending}>
            {place ? "Salvar" : "Adicionar à viagem"}
          </Button>
        </form>
      )}
    </ResponsiveDialog>
  )
}
