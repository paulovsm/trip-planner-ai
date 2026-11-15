"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useJsApiLoader } from "@react-google-maps/api"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Calendar as CalendarIcon, Loader2, MapPin, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { DocumentImporter } from "@/components/features/importer/document-importer"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { api, errorMessage } from "@/lib/client/api"
import { buildImportCommit, type DraftPlace } from "@/lib/client/import-plan"
import { CATEGORY_LABELS, PLACE_CATEGORIES, type PlaceCategory } from "@/lib/domain/categories"
import type { ImportedDay, ImportResult } from "@/lib/domain/import"
import { cn } from "@/lib/utils"

const libraries: "places"[] = ["places"]

type Draft = DraftPlace & { key: string }

/** Client-side geocoding; replaced by server-side Places resolution in F4. */
async function locate(geocoder: google.maps.Geocoder, p: DraftPlace) {
  const queries = [
    p.city && `${p.name}, ${p.city}`,
    p.address && `${p.name}, ${p.address}`,
    p.address,
    p.name,
  ].filter(Boolean) as string[]
  for (const address of queries) {
    try {
      const { results } = await geocoder.geocode({ address })
      const loc = results?.[0]?.geometry.location
      if (loc) return { lat: loc.lat(), lng: loc.lng() }
    } catch {
      // try the next query
    }
  }
  return undefined
}

function DateField({ label, value, onChange }: { label: string; value?: Date; onChange: (d?: Date) => void }) {
  return (
    <div className="space-y-2 flex flex-col">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            {value ? format(value, "dd/MM/yyyy") : <span>Selecione</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange} locale={ptBR} initialFocus />
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default function NewTripPage() {
  const router = useRouter()
  const [places, setPlaces] = useState<Draft[]>([])
  const [importedDays, setImportedDays] = useState<ImportedDay[]>([])
  const [tripName, setTripName] = useState("")
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
  })

  const handleImport = async (data: ImportResult) => {
    const drafts: Draft[] = data.places.map((p) => ({ ...p, key: crypto.randomUUID() }))
    setImportedDays((prev) => [...prev, ...data.days])
    if (!isLoaded) {
      toast.warning("O mapa ainda não carregou; os lugares ficarão sem localização.")
      setPlaces((prev) => [...prev, ...drafts])
      return
    }
    setIsGeocoding(true)
    try {
      const geocoder = new google.maps.Geocoder()
      const located = await Promise.all(drafts.map(async (p) => ({ ...p, location: await locate(geocoder, p) })))
      setPlaces((prev) => [...prev, ...located])
      const missing = located.filter((p) => !p.location).length
      if (missing) toast.warning(`${missing} lugar(es) não foram encontrados no mapa e não serão salvos.`)
    } finally {
      setIsGeocoding(false)
    }
  }

  const update = (key: string, patch: Partial<Draft>) =>
    setPlaces((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)))

  const handleSave = async () => {
    if (!tripName.trim()) {
      toast.error("Por favor, dê um nome para a viagem.")
      return
    }
    if (startDate && endDate && endDate < startDate) {
      toast.error("A data de término deve ser igual ou posterior à de início.")
      return
    }
    setIsSaving(true)
    try {
      const start = startDate ? format(startDate, "yyyy-MM-dd") : undefined
      const trip = await api.trips.create({
        name: tripName.trim(),
        startDate: start,
        endDate: endDate ? format(endDate, "yyyy-MM-dd") : undefined,
      })
      const drafts: DraftPlace[] = places.map(({ name, category, description, address, city, location }) => ({
        name,
        category,
        description: description || undefined,
        address: address || undefined,
        city: city || undefined,
        location,
      }))
      const { commit, skippedPlaces, skippedDays } = buildImportCommit(drafts, importedDays, start)
      if (commit.places.length || commit.days.length) await api.import.commit(trip.id, commit)
      if (skippedPlaces) toast.warning(`${skippedPlaces} lugar(es) sem localização não foram salvos.`)
      if (skippedDays) toast.warning(`${skippedDays} dia(s) sem data foram ignorados. Defina a data de início para incluí-los.`)
      toast.success("Viagem criada com sucesso!")
      router.push(`/trips/${trip.id}`)
    } catch (error) {
      toast.error(errorMessage(error, "Erro ao salvar viagem."))
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto p-4 md:p-8">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
          <h1 className="text-2xl md:text-3xl font-bold">Nova Viagem</h1>
          <Button onClick={handleSave} disabled={isSaving || isGeocoding}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar Viagem
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Detalhes da Viagem</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tripName">Nome da Viagem</Label>
                  <Input
                    id="tripName"
                    placeholder="Ex: Férias na Europa 2026"
                    value={tripName}
                    maxLength={120}
                    onChange={(e) => setTripName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <DateField label="Data de Início" value={startDate} onChange={setStartDate} />
                  <DateField label="Data de Término" value={endDate} onChange={setEndDate} />
                </div>
              </CardContent>
            </Card>

            <DocumentImporter onImport={handleImport} />
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">Pontos de Interesse ({places.length})</h2>
              {isGeocoding && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Localizando" />}
            </div>

            {places.length === 0 ? (
              <div className="text-center p-12 border-2 border-dashed rounded-lg text-muted-foreground">
                Importe um documento para preencher a viagem, ou salve e adicione pontos depois.
              </div>
            ) : (
              <div className="space-y-4">
                {places.map((p) => (
                  <Card key={p.key}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor={`${p.key}-name`}>Nome</Label>
                              <Input id={`${p.key}-name`} value={p.name} onChange={(e) => update(p.key, { name: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`${p.key}-category`}>Categoria</Label>
                              <select
                                id={`${p.key}-category`}
                                value={p.category}
                                onChange={(e) => update(p.key, { category: e.target.value as PlaceCategory })}
                                className="border-input bg-transparent dark:bg-input/30 h-9 w-full rounded-md border px-3 text-sm"
                              >
                                {PLACE_CATEGORIES.map((c) => (
                                  <option key={c} value={c}>
                                    {CATEGORY_LABELS[c]}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`${p.key}-address`}>Endereço</Label>
                            <div className="flex gap-2 items-center">
                              <Input
                                id={`${p.key}-address`}
                                value={p.address ?? ""}
                                onChange={(e) => update(p.key, { address: e.target.value })}
                              />
                              <span
                                className={cn(
                                  "flex items-center gap-1 text-xs whitespace-nowrap",
                                  p.location ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400",
                                )}
                              >
                                <MapPin className="h-4 w-4" />
                                {p.location ? "Localizado" : "Sem localização"}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`${p.key}-description`}>Descrição</Label>
                            <Textarea
                              id={`${p.key}-description`}
                              value={p.description ?? ""}
                              onChange={(e) => update(p.key, { description: e.target.value })}
                            />
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive/90"
                          onClick={() => setPlaces((prev) => prev.filter((x) => x.key !== p.key))}
                          aria-label={`Remover ${p.name}`}
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
