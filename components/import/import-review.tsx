"use client"

import { useMemo, useState } from "react"
import { addDays, format, parseISO } from "date-fns"
import { Check, MapPin, MapPinOff, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PlaceSearch } from "@/components/places/place-search"
import { CategoryBadge } from "@/components/trip/category-badge"
import type { CommitImportInput } from "@/lib/client/api"
import { toCommit, type ReviewDay, type ReviewRow } from "@/lib/client/import-plan"
import { CATEGORY_LABELS, PLACE_CATEGORIES, type PlaceCategory } from "@/lib/domain/categories"
import type { ImportPreview } from "@/lib/domain/import"
import { cn } from "@/lib/utils"

type Row = ReviewRow
type DayRow = ReviewDay

/** Review extracted places/days before writing anything (ADR: nothing is saved without review). */
export function ImportReview({
  preview,
  startDate,
  submitting,
  submitLabel = "Salvar na viagem",
  onSubmit,
  onCancel,
}: {
  preview: ImportPreview
  startDate?: string
  submitting?: boolean
  submitLabel?: string
  onSubmit: (commit: CommitImportInput) => void
  onCancel?: () => void
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    preview.places.map((p, i) => ({ ...p, key: `${i}-${p.name}`, include: true })),
  )
  const [days, setDays] = useState<DayRow[]>(() =>
    preview.days.map((d, i) => ({
      key: `${i}`,
      dayNumber: d.dayNumber,
      date: d.date ?? (startDate ? format(addDays(parseISO(startDate), d.dayNumber - 1), "yyyy-MM-dd") : ""),
      places: d.places,
    })),
  )
  const [fixing, setFixing] = useState<string | null>(null)
  const commit = useMemo(() => toCommit(rows, days), [rows, days])
  const missing = rows.filter((r) => r.include && !r.location).length
  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  return (
    <div className="space-y-5">
      {preview.resolution === "unavailable" && (
        <p className="bg-muted rounded-lg p-3 text-sm">
          A localização automática não está disponível no servidor. Use “Localizar” em cada lugar para escolhê-lo no mapa.
        </p>
      )}

      <section className="space-y-2" aria-label="Lugares encontrados">
        <h3 className="font-semibold">
          Lugares ({rows.filter((r) => r.include).length} de {rows.length})
        </h3>
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.key} className={cn("rounded-xl border p-3", !r.include && "opacity-60")}>
              <div className="flex items-start gap-3">
                <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={r.include}
                    onChange={(e) => update(r.key, { include: e.target.checked })}
                    aria-label={`Incluir ${r.name}`}
                  />
                </label>
                <CategoryBadge category={r.category} className="mt-1.5" />
                <div className="min-w-0 flex-1 space-y-1">
                  <Input value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} aria-label="Nome" className="h-9 font-medium" />
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <select
                      value={r.category}
                      onChange={(e) => update(r.key, { category: e.target.value as PlaceCategory })}
                      aria-label="Categoria"
                      className="border-input bg-transparent dark:bg-input/30 h-8 rounded-md border px-2 pointer-coarse:h-11"
                    >
                      {PLACE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {CATEGORY_LABELS[c]}
                        </option>
                      ))}
                    </select>
                    {r.location ? (
                      <span className="text-success flex items-center gap-1">
                        <MapPin className="size-3.5" /> {r.matchedAddress ?? r.city ?? "Localizado"}
                      </span>
                    ) : (
                      <span className="text-destructive flex items-center gap-1">
                        <MapPinOff className="size-3.5" /> Sem localização
                      </span>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setFixing(fixing === r.key ? null : r.key)}>
                      <Search /> {r.location ? "Corrigir" : "Localizar"}
                    </Button>
                  </div>
                  {fixing === r.key && (
                    <div className="pt-2">
                      <PlaceSearch
                        autoFocus
                        placeholder={`Buscar “${r.name}”`}
                        onPick={(p) => {
                          update(r.key, {
                            location: p.location,
                            googlePlaceId: p.googlePlaceId,
                            matchedAddress: p.address,
                            address: p.address,
                            city: p.city ?? r.city,
                          })
                          setFixing(null)
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {days.length > 0 && (
        <section className="space-y-2" aria-label="Dias do roteiro">
          <h3 className="font-semibold">Dias ({days.length})</h3>
          <p className="text-muted-foreground text-xs">Confira as datas; dias sem data não são salvos.</p>
          <ul className="space-y-2">
            {days.map((d) => (
              <li key={d.key} className="flex items-center gap-3 rounded-xl border p-3">
                <span className="w-14 shrink-0 text-sm font-medium">Dia {d.dayNumber}</span>
                <Input
                  type="date"
                  value={d.date}
                  onChange={(e) => setDays((ds) => ds.map((x) => (x.key === d.key ? { ...x, date: e.target.value } : x)))}
                  aria-label={`Data do dia ${d.dayNumber}`}
                  className="w-40 pointer-coarse:h-11"
                />
                <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">{d.places.join(", ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="space-y-2">
        {missing > 0 && (
          <p className="text-muted-foreground text-xs">{missing} lugar(es) sem localização não serão salvos.</p>
        )}
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="ghost" className="flex-1" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <Button className="flex-1" disabled={submitting || commit.places.length === 0} onClick={() => onSubmit(commit)}>
            <Check /> {submitLabel} ({commit.places.length})
          </Button>
        </div>
      </div>
    </div>
  )
}
