"use client"

import { AlertTriangle, Loader2, Route as RouteIcon, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { canOptimize, isRouteStale, routeSummary } from "@/lib/domain/route"
import type { Day } from "@/lib/domain/schemas"
import { useComputeRoute, useOptimizeDay } from "@/hooks/use-trip-mutations"
import { GpxExport } from "./gpx-export"
import { useTrip } from "./trip-context"

/** Route status for a Day: summary, recompute, optimize and GPX export. */
export function RouteBar({ day, dayNumber }: { day: Day; dayNumber: number }) {
  const { tripId } = useTrip()
  const compute = useComputeRoute(tripId)
  const optimize = useOptimizeDay(tripId)
  if (day.stops.length < 2) return null

  const stale = isRouteStale(day)
  const optimizable = canOptimize(day)
  const busy = compute.isPending || optimize.isPending

  return (
    <div className="bg-muted/60 space-y-2 rounded-xl p-3">
      <div className="flex items-center gap-2 text-sm">
        <RouteIcon className="text-primary size-4 shrink-0" aria-hidden />
        {day.route && !stale ? (
          <span className="font-medium">{routeSummary(day.route)}</span>
        ) : (
          <span className="text-muted-foreground">
            {day.route ? "Percurso desatualizado" : "Percurso ainda não calculado"}
          </span>
        )}
        {(stale || !day.route) && (
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => compute.mutate(day.id)} disabled={busy}>
            {compute.isPending ? <Loader2 className="animate-spin" /> : null}
            {day.route ? "Recalcular" : "Calcular"}
          </Button>
        )}
      </div>
      {day.route?.warnings?.length && !stale ? (
        <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {day.route.warnings[0]}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => optimize.mutate({ dayId: day.id, expectedVersion: day.version })}
          disabled={busy || !optimizable.ok}
          title={optimizable.ok ? "Reordenar as paradas do meio para o menor percurso" : optimizable.reason}
        >
          {optimize.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} Otimizar ordem
        </Button>
        <GpxExport day={day} dayNumber={dayNumber} />
      </div>
      {!optimizable.ok && day.stops.length >= 2 && <p className="text-muted-foreground text-xs">{optimizable.reason}</p>}
    </div>
  )
}
