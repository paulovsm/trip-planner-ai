"use client"

import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { Textarea } from "@/components/ui/textarea"
import type { Stop } from "@/lib/domain/schemas"
import { useEditStop } from "@/hooks/use-trip-mutations"
import { useTrip } from "./trip-context"

/** Edits a Stop's planned time, duration and notes. */
export function StopEditor({
  dayId,
  stop,
  open,
  onOpenChange,
}: {
  dayId: string
  stop: Stop
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { tripId, placesById } = useTrip()
  const edit = useEditStop(tripId)
  const id = useId()
  const [time, setTime] = useState(stop.time ?? "")
  const [duration, setDuration] = useState(stop.durationMin?.toString() ?? "")
  const [notes, setNotes] = useState(stop.notes ?? "")

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const minutes = duration.trim() === "" ? null : Math.max(0, Math.min(1440, Math.round(Number(duration))))
    edit.mutate(
      { dayId, stopId: stop.id, time: time || null, durationMin: Number.isFinite(minutes) ? minutes : null, notes: notes.trim() || null },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={placesById.get(stop.placeId)?.name ?? "Parada"}
      description="Horário, tempo previsto no local e anotações (as notas não aparecem no link público)."
    >
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor={`${id}-time`}>Horário</Label>
            <Input id={`${id}-time`} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-dur`}>Duração (min)</Label>
            <Input
              id={`${id}-dur`}
              type="number"
              inputMode="numeric"
              min={0}
              max={1440}
              step={5}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="60"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-notes`}>Notas</Label>
          <Textarea
            id={`${id}-notes`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            placeholder="Ex.: código da reserva, entrada pelo portão lateral…"
          />
        </div>
        <Button type="submit" className="w-full" disabled={edit.isPending}>
          Salvar
        </Button>
      </form>
    </ResponsiveDialog>
  )
}
