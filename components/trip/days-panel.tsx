"use client"

import { useEffect, useRef } from "react"
import { CalendarDays } from "lucide-react"
import { dayChipLabel, isPastDay } from "@/lib/client/trip-view"
import { cn } from "@/lib/utils"
import { AddDayDialog } from "./add-day-dialog"
import { DayCard } from "./day-card"
import { useTrip } from "./trip-context"

export function DaysPanel() {
  const { detail, selectedDay, selectDay } = useTrip()
  const activeChip = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeChip.current?.scrollIntoView({ block: "nearest", inline: "center" })
  }, [selectedDay?.id])

  if (detail.days.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 p-8 text-center">
        <CalendarDays className="text-muted-foreground size-10" />
        <div>
          <p className="font-medium">Nenhum dia no roteiro</p>
          <p className="text-muted-foreground text-sm">Adicione um dia e depois as paradas na ordem da visita.</p>
        </div>
        <AddDayDialog />
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1">
        <div className="flex items-center gap-2" role="tablist" aria-label="Dias">
        {detail.days.map((d) => {
          const active = d.id === selectedDay?.id
          return (
            <button
              key={d.id}
              ref={active ? activeChip : undefined}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectDay(d.id)}
              className={cn(
                "min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium",
                active ? "bg-primary text-primary-foreground border-primary" : "bg-background",
                !active && isPastDay(d.date) && "text-muted-foreground",
              )}
            >
              {dayChipLabel(d.date)}
            </button>
          )
        })}
        </div>
        <AddDayDialog compact />
      </div>
      {selectedDay && <DayCard key={selectedDay.id} day={selectedDay} />}
    </div>
  )
}
