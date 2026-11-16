"use client"

import { useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { Bike, Download, Footprints, Loader2, Route as RouteIcon, Share2, Watch } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { api, errorMessage } from "@/lib/client/api"
import { isRouteStale, routeSummary } from "@/lib/domain/route"
import type { Day, Route } from "@/lib/domain/schemas"
import { buildDayGpx, decodePolyline, gpxFilename, isLoop } from "@/lib/gpx"
import { useComputeRoute } from "@/hooks/use-trip-mutations"
import { useTrip } from "./trip-context"

type ExportMode = "WALK" | "BICYCLE"

/**
 * GPX Export (ADR-0004): one file per Day with the dense Route track and the Stops as
 * waypoints, for Huawei Health → GT 7. Generated in the browser from the stored Route,
 * so it also works offline once the Route exists.
 */
export function GpxExport({ day, dayNumber }: { day: Day; dayNumber: number }) {
  const { tripId, detail, placesById } = useTrip()
  const [open, setOpen] = useState(false)
  const [exportRoute, setExportRoute] = useState<Route | null>(null)
  const [loadingMode, setLoadingMode] = useState<ExportMode | null>(null)
  const [includeWaypoints, setIncludeWaypoints] = useState(true)
  const computeRoute = useComputeRoute(tripId)

  const nativeMode = day.travelMode === "WALK" || day.travelMode === "BICYCLE"
  const route: Route | null = nativeMode ? (isRouteStale(day) ? null : day.route) : exportRoute

  const file = useMemo(() => {
    if (!route) return null
    const stops = day.stops.flatMap((s) => {
      const p = placesById.get(s.placeId)
      return p ? [{ name: p.name, lat: p.location.lat, lng: p.location.lng }] : []
    })
    const track = decodePolyline(route.encodedPolyline)
    const label = format(parseISO(day.date), "dd/MM")
    const xml = buildDayGpx({
      name: `${detail.trip.name} · Dia ${dayNumber} (${label})`,
      description: `${routeSummary(route)} · TripPlanner`,
      stops,
      track,
      mode: route.travelMode === "BICYCLE" ? "cycling" : "walking",
      includeWaypoints,
    })
    const name = gpxFilename(detail.trip.name, day.date, dayNumber)
    return { file: new File([xml], name, { type: "application/gpx+xml" }), loop: isLoop(track) }
  }, [route, day, placesById, detail.trip.name, dayNumber, includeWaypoints])

  const canShareFile =
    !!file && typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file.file] })

  const loadExportRoute = async (mode: ExportMode) => {
    setLoadingMode(mode)
    try {
      setExportRoute(await api.days.exportRoute(tripId, day.id, mode))
    } catch (err) {
      toast.error(errorMessage(err, "Não foi possível calcular o percurso."))
    } finally {
      setLoadingMode(null)
    }
  }

  const download = () => {
    if (!file) return
    const url = URL.createObjectURL(file.file)
    const a = document.createElement("a")
    a.href = url
    a.download = file.file.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const share = async () => {
    if (!file) return
    try {
      await navigator.share({ files: [file.file], title: file.file.name })
    } catch (err) {
      if ((err as Error).name !== "AbortError") download()
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={day.stops.length < 2}>
        <Watch /> GPX
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title="Exportar GPX para o relógio" description="Um arquivo por dia, com o percurso e as paradas.">
        <div className="space-y-4">
          {!nativeMode && !exportRoute && (
            <div className="space-y-2">
              <p className="text-sm">
                Este dia é de {day.travelMode === "DRIVE" ? "carro" : "transporte público"}. Calcular um percurso só para o GPX
                (o modo do dia não muda):
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(["WALK", "BICYCLE"] as const).map((m) => (
                  <Button key={m} variant="outline" onClick={() => loadExportRoute(m)} disabled={!!loadingMode}>
                    {loadingMode === m ? <Loader2 className="animate-spin" /> : m === "WALK" ? <Footprints /> : <Bike />}
                    {m === "WALK" ? "A pé" : "De bike"}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {nativeMode && !route && (
            <div className="space-y-2">
              <p className="text-sm">
                {day.route ? "O percurso está desatualizado." : "Ainda não há percurso calculado para este dia."}
              </p>
              <Button className="w-full" onClick={() => computeRoute.mutate(day.id)} disabled={computeRoute.isPending}>
                {computeRoute.isPending ? <Loader2 className="animate-spin" /> : <RouteIcon />} Calcular percurso
              </Button>
            </div>
          )}

          {file && route && (
            <>
              <div className="bg-muted rounded-lg p-3 text-sm">
                <p className="font-medium">{file.file.name}</p>
                <p className="text-muted-foreground">
                  {route.travelMode === "BICYCLE" ? "De bike" : "A pé"} · {routeSummary(route)} · {day.stops.length} paradas
                </p>
              </div>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={includeWaypoints}
                  onChange={(e) => setIncludeWaypoints(e.target.checked)}
                />
                Incluir as paradas como pontos (waypoints)
              </label>
              <div className="grid gap-2">
                {canShareFile && (
                  <Button onClick={share}>
                    <Share2 /> Compartilhar (Huawei Health)
                  </Button>
                )}
                <Button variant={canShareFile ? "outline" : "default"} onClick={download}>
                  <Download /> Baixar .gpx
                </Button>
              </div>
              <div className="text-muted-foreground space-y-1 text-xs">
                <p className="text-foreground font-medium">No Huawei Health</p>
                <ol className="list-decimal space-y-0.5 pl-4">
                  <li>Eu → Minhas rotas → Importar rota → escolha o arquivo .gpx</li>
                  <li>Abra a rota → Enviar para o relógio</li>
                  <li>No GT 7: Exercício → Caminhada (ou Ciclismo) ao ar livre → Rotas</li>
                </ol>
                {file.loop && <p>Rota em loop: comece a pelo menos 30 m do ponto inicial para a navegação não terminar cedo.</p>}
              </div>
            </>
          )}
        </div>
      </ResponsiveDialog>
    </>
  )
}
