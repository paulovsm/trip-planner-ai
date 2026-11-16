"use client"

import Link from "next/link"
import { useMutationState } from "@tanstack/react-query"
import { ArrowLeft, CloudOff, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { tripDatesLabel } from "@/lib/client/trip-view"
import type { TripDetail } from "@/lib/domain/dto"
import { useOnlineStatus } from "@/hooks/use-online-status"
import { VISITED_MUTATION_KEY } from "@/hooks/use-trip-mutations"

export function TripHeader({ trip, floating }: { trip: TripDetail["trip"]; floating?: boolean }) {
  const online = useOnlineStatus()
  const pending = useMutationState({ filters: { mutationKey: VISITED_MUTATION_KEY, predicate: (m) => m.state.isPaused } }).length
  return (
    <header
      style={floating ? { top: "calc(env(safe-area-inset-top) + 0.75rem)" } : undefined}
      className={
        floating
          ? "bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-3 z-30 flex items-center gap-2 rounded-2xl border px-2 py-1.5 shadow-md backdrop-blur"
          : "flex items-center gap-2 border-b px-3 py-2"
      }
    >
      <Button asChild variant="ghost" size="icon" aria-label="Voltar para Minhas Viagens">
        <Link href="/trips">
          <ArrowLeft />
        </Link>
      </Button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold leading-tight">{trip.name}</h1>
        <p className="text-muted-foreground truncate text-xs">{tripDatesLabel(trip.startDate, trip.endDate)}</p>
      </div>
      {pending > 0 && (
        <span className="text-muted-foreground flex items-center gap-1 rounded-full border px-2 py-1 text-xs" role="status">
          <RefreshCw className="size-3.5" /> {pending} {pending === 1 ? "pendente" : "pendentes"}
        </span>
      )}
      {!online && (
        <span className="text-muted-foreground flex items-center gap-1 rounded-full border px-2 py-1 text-xs" role="status">
          <CloudOff className="size-3.5" /> Offline
        </span>
      )}
    </header>
  )
}
