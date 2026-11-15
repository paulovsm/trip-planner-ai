"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CalendarPlus } from "lucide-react"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"
import { api, errorMessage } from "@/lib/client/api"
import { ptBR } from "date-fns/locale"

interface Itinerary {
  id: string
  date: string
}

interface AddToItineraryDialogProps {
  tripId: string
  pointId: string
  itineraries: Itinerary[]
  onSuccess: () => Promise<void> | void
}

export function AddToItineraryDialog({ tripId, pointId, itineraries, onSuccess }: AddToItineraryDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedItineraryId, setSelectedItineraryId] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!selectedItineraryId) return

    try {
      setIsSubmitting(true)
      await api.days.addStop(tripId, selectedItineraryId, { placeId: pointId })
      toast.success("Ponto adicionado ao roteiro!")
      setOpen(false)
      setSelectedItineraryId("")
      await onSuccess()
    } catch (error) {
      toast.error(errorMessage(error, "Erro ao adicionar ponto."))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6 text-muted-foreground hover:text-primary"
          onClick={(e) => e.stopPropagation()}
          title="Adicionar ao roteiro"
        >
          <CalendarPlus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Adicionar ao Roteiro</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Select value={selectedItineraryId} onValueChange={setSelectedItineraryId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o dia" />
            </SelectTrigger>
            <SelectContent>
              {itineraries.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground text-center">Nenhum dia criado</div>
              ) : (
                itineraries.map((itinerary) => (
                  <SelectItem key={itinerary.id} value={itinerary.id}>
                    {format(parseISO(itinerary.date), "dd 'de' MMMM", { locale: ptBR })}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button onClick={handleSubmit} disabled={!selectedItineraryId || isSubmitting} className="w-full">
            Adicionar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
