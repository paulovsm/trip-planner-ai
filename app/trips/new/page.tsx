"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ImportReview } from "@/components/import/import-review"
import { ImportUpload } from "@/components/import/import-upload"
import { MapsProvider } from "@/components/map/maps-provider"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, errorMessage, queryKeys, type CommitImportInput } from "@/lib/client/api"
import { tripDatesLabel } from "@/lib/client/trip-view"
import type { ImportPreview } from "@/lib/domain/import"

export default function NewTripPage() {
  return (
    <MapsProvider>
      <NewTripForm />
    </MapsProvider>
  )
}

/** Name + period, optional import (upload → review). The Trip is created first, then the import is committed. */
function NewTripForm() {
  const router = useRouter()
  const qc = useQueryClient()
  const [name, setName] = useState("")
  const [range, setRange] = useState<{ from?: Date; to?: Date }>({})
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [saving, setSaving] = useState(false)
  const iso = (d?: Date) => (d ? format(d, "yyyy-MM-dd") : undefined)

  const create = async (commit?: CommitImportInput) => {
    if (!name.trim()) {
      toast.error("Dê um nome para a viagem.")
      return
    }
    setSaving(true)
    try {
      const trip = await api.trips.create({ name: name.trim(), startDate: iso(range.from), endDate: iso(range.to ?? range.from) })
      if (commit && (commit.places.length || commit.days.length)) await api.import.commit(trip.id, commit)
      qc.invalidateQueries({ queryKey: queryKeys.trips })
      toast.success("Viagem criada!")
      router.push(`/trips/${trip.id}`)
    } catch (err) {
      toast.error(errorMessage(err, "Erro ao criar a viagem."))
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <Navbar />
      <main className="container mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-6">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" aria-label="Voltar">
            <Link href="/trips">
              <ArrowLeft />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Nova viagem</h1>
        </div>

        <section className="space-y-4 rounded-2xl border p-4">
          <div className="space-y-2">
            <Label htmlFor="trip-name">Nome</Label>
            <Input
              id="trip-name"
              placeholder="Ex.: Lisboa e Porto 2026"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              className="pointer-coarse:h-11"
            />
          </div>
          <div className="space-y-2">
            <Label>Período</Label>
            <p className="text-muted-foreground text-sm">{tripDatesLabel(iso(range.from), iso(range.to))}</p>
            <div className="flex justify-center">
              <Calendar
                mode="range"
                selected={range.from ? { from: range.from, to: range.to } : undefined}
                onSelect={(r) => setRange({ from: r?.from, to: r?.to })}
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold">Importar roteiro (opcional)</h2>
          {preview ? (
            <ImportReview
              preview={preview}
              startDate={iso(range.from)}
              submitting={saving}
              submitLabel="Criar viagem"
              onSubmit={(commit) => create(commit)}
              onCancel={() => setPreview(null)}
            />
          ) : (
            <ImportUpload onPreview={setPreview} />
          )}
        </section>

        {!preview && (
          <Button className="w-full" size="lg" onClick={() => create()} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} Criar viagem
          </Button>
        )}
      </main>
    </div>
  )
}
