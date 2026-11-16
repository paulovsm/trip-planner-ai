"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { CalendarPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { useCreateDay } from "@/hooks/use-trip-mutations"
import { useTrip } from "./trip-context"

export function AddDayDialog({ compact }: { compact?: boolean }) {
  const { tripId, detail, selectDay } = useTrip()
  const [open, setOpen] = useState(false)
  const createDay = useCreateDay(tripId)
  const used = new Set(detail.days.map((d) => d.date))
  const { startDate, endDate } = detail.trip
  const start = startDate ? parseISO(startDate) : undefined
  const end = endDate ? parseISO(endDate) : undefined

  const pick = (date?: Date) => {
    if (!date) return
    createDay.mutate(
      { date: format(date, "yyyy-MM-dd") },
      {
        onSuccess: (day) => {
          selectDay(day.id)
          setOpen(false)
        },
      },
    )
  }

  return (
    <>
      <Button variant="outline" size={compact ? "sm" : "default"} onClick={() => setOpen(true)}>
        <CalendarPlus /> {compact ? "Dia" : "Adicionar dia"}
      </Button>
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Adicionar dia"
        description={start ? "Datas fora do período da viagem ficam desabilitadas." : undefined}
      >
        <div className="flex justify-center">
          <Calendar
            mode="single"
            onSelect={pick}
            defaultMonth={start}
            disabled={[
              (d) => used.has(format(d, "yyyy-MM-dd")),
              ...(start ? [{ before: start }] : []),
              ...(end ? [{ after: end }] : []),
            ]}
          />
        </div>
      </ResponsiveDialog>
    </>
  )
}
