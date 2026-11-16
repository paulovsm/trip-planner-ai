"use client"

import { useMemo, useState } from "react"
import { MapPin, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CATEGORY_LABELS } from "@/lib/domain/categories"
import { PlaceEditor } from "./place-editor"
import { PlaceRow } from "./place-row"
import { useTrip } from "./trip-context"

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

export function PlacesPanel() {
  const { detail, selectPlace } = useTrip()
  const [query, setQuery] = useState("")
  const [adding, setAdding] = useState(false)

  const groups = useMemo(() => {
    const q = normalize(query.trim())
    const filtered = detail.places.filter(
      (p) => !q || normalize(`${p.name} ${p.city ?? ""} ${CATEGORY_LABELS[p.category]} ${p.description ?? ""}`).includes(q),
    )
    const byCity = new Map<string, typeof filtered>()
    for (const p of filtered) {
      const city = p.city || "Sem cidade"
      byCity.set(city, [...(byCity.get(city) ?? []), p])
    }
    return [...byCity.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
  }, [detail.places, query])

  const visited = detail.places.filter((p) => p.visited).length

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar lugares"
            aria-label="Filtrar lugares"
            className="pl-9 pointer-coarse:h-11"
          />
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus /> Lugar
        </Button>
      </div>

      {detail.places.length > 0 && (
        <p className="text-muted-foreground text-xs">
          {detail.places.length} {detail.places.length === 1 ? "lugar" : "lugares"} · {visited} visitado{visited === 1 ? "" : "s"}
        </p>
      )}

      {detail.places.length === 0 ? (
        <div className="flex flex-col items-center gap-3 p-8 text-center">
          <MapPin className="text-muted-foreground size-10" />
          <p className="font-medium">Nenhum lugar salvo</p>
          <p className="text-muted-foreground text-sm">Busque atrações, restaurantes e hotéis para montar o roteiro.</p>
        </div>
      ) : groups.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">Nenhum lugar corresponde a “{query}”.</p>
      ) : (
        groups.map(([city, places]) => (
          <section key={city} aria-label={city} className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {city} ({places.length})
            </h3>
            <ul className="space-y-2">
              {places.map((p) => (
                <PlaceRow key={p.id} place={p} />
              ))}
            </ul>
          </section>
        ))
      )}

      {adding && <PlaceEditor open={adding} onOpenChange={setAdding} onCreated={(p) => selectPlace(p.id)} />}
    </div>
  )
}
