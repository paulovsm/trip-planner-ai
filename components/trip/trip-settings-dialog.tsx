"use client"

import { useId, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { api, errorMessage, queryKeys } from "@/lib/client/api"
import { tripDatesLabel } from "@/lib/client/trip-view"
import { useTrip } from "./trip-context"

export function TripSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { tripId, detail } = useTrip()
  const qc = useQueryClient()
  const id = useId()
  const [name, setName] = useState(detail.trip.name)
  const [range, setRange] = useState<{ from?: Date; to?: Date }>({
    from: detail.trip.startDate ? parseISO(detail.trip.startDate) : undefined,
    to: detail.trip.endDate ? parseISO(detail.trip.endDate) : undefined,
  })

  const save = useMutation({
    mutationFn: () =>
      api.trips.update(tripId, {
        name: name.trim(),
        startDate: range.from ? format(range.from, "yyyy-MM-dd") : null,
        endDate: range.to ? format(range.to, "yyyy-MM-dd") : range.from ? format(range.from, "yyyy-MM-dd") : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.trip(tripId) })
      qc.invalidateQueries({ queryKey: queryKeys.trips })
      toast.success("Viagem atualizada.")
      onOpenChange(false)
    },
    onError: (err) => toast.error(errorMessage(err, "Erro ao salvar.")),
  })

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="Dados da viagem">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) save.mutate()
        }}
      >
        <div className="space-y-2">
          <Label htmlFor={`${id}-name`}>Nome</Label>
          <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
        </div>
        <div className="space-y-2">
          <Label>Período</Label>
          <p className="text-muted-foreground text-sm">
            {tripDatesLabel(range.from && format(range.from, "yyyy-MM-dd"), range.to && format(range.to, "yyyy-MM-dd"))}
          </p>
          <div className="flex justify-center">
            <Calendar
              mode="range"
              selected={range.from ? { from: range.from, to: range.to } : undefined}
              onSelect={(r) => setRange({ from: r?.from, to: r?.to })}
              defaultMonth={range.from}
            />
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={save.isPending}>
          Salvar
        </Button>
      </form>
    </ResponsiveDialog>
  )
}
