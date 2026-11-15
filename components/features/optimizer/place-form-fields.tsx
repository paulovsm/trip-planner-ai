"use client"

import { useId } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CATEGORY_LABELS, PLACE_CATEGORIES, type PlaceCategory } from "@/lib/domain/categories"

export type PlaceFormData = {
  name: string
  city: string
  category: PlaceCategory
  address: string
  description: string
}

export const emptyPlaceForm: PlaceFormData = { name: "", city: "", category: "outros", address: "", description: "" }

/** Client-side geocoding (replaced by Places Autocomplete in F2). Returns null when not found. */
export async function geocodePlace(form: PlaceFormData): Promise<{ lat: number; lng: number } | null> {
  if (typeof window === "undefined" || !window.google?.maps) return null
  const geocoder = new window.google.maps.Geocoder()
  const queries = [form.address, [form.name, form.city].filter(Boolean).join(", ")].filter(Boolean)
  for (const address of queries) {
    try {
      const { results } = await geocoder.geocode({ address })
      const loc = results?.[0]?.geometry.location
      if (loc) return { lat: loc.lat(), lng: loc.lng() }
    } catch {
      // try the next query
    }
  }
  return null
}

/** Builds the API payload; empty optional fields are omitted. */
export function toPlaceInput(form: PlaceFormData) {
  const opt = (v: string) => (v.trim() ? v.trim() : undefined)
  return {
    name: form.name.trim(),
    category: form.category,
    city: opt(form.city),
    address: opt(form.address),
    description: opt(form.description),
  }
}

export function PlaceFormFields({
  value,
  onChange,
  addressHint,
}: {
  value: PlaceFormData
  onChange: (next: PlaceFormData) => void
  addressHint?: string
}) {
  const id = useId()
  const set = (key: keyof PlaceFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    onChange({ ...value, [key]: e.target.value })

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${id}-name`}>Nome *</Label>
        <Input id={`${id}-name`} value={value.name} onChange={set("name")} placeholder="Ex: Torre Eiffel" required maxLength={200} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-city`}>Cidade</Label>
        <Input id={`${id}-city`} value={value.city} onChange={set("city")} placeholder="Ex: Paris" maxLength={120} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-category`}>Categoria</Label>
        <select
          id={`${id}-category`}
          value={value.category}
          onChange={set("category")}
          className="border-input bg-transparent dark:bg-input/30 h-9 w-full rounded-md border px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {PLACE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-address`}>Endereço</Label>
        <Input id={`${id}-address`} value={value.address} onChange={set("address")} placeholder="Endereço completo" maxLength={300} />
        {addressHint && <p className="text-xs text-muted-foreground">{addressHint}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-description`}>Descrição</Label>
        <Textarea
          id={`${id}-description`}
          value={value.description}
          onChange={set("description")}
          placeholder="Breve descrição do local"
          maxLength={2000}
        />
      </div>
    </>
  )
}
