"use client"

import Link from "next/link"
import { ArrowLeft, CloudOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { tripDatesLabel } from "@/lib/client/trip-view"
import type { TripDetail } from "@/lib/domain/dto"
import { useOnlineStatus } from "@/hooks/use-online-status"

export function TripHeader({ trip, floating }: { trip: TripDetail["trip"]; floating?: boolean }) {
  const online = useOnlineStatus()
  return (
    <header
      className={
        floating
          ? "bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-3 top-3 z-30 flex items-center gap-2 rounded-2xl border px-2 py-1.5 shadow-md backdrop-blur pt-safe"
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
      {!online && (
        <span className="text-muted-foreground flex items-center gap-1 rounded-full border px-2 py-1 text-xs" role="status">
          <CloudOff className="size-3.5" /> Offline
        </span>
      )}
    </header>
  )
}
