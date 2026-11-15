"use client"

import { useState } from "react"
import { Pencil } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { api, errorMessage } from "@/lib/client/api"
import type { LegacyPoint } from "@/lib/client/legacy-view"
import { geocodePlace, PlaceFormFields, toPlaceInput, type PlaceFormData } from "./place-form-fields"

interface EditPointDialogProps {
  tripId: string
  point: LegacyPoint
  onSuccess: () => Promise<void> | void
}

const fromPoint = (p: LegacyPoint): PlaceFormData => ({
  name: p.name,
  city: p.city ?? "",
  category: p.categoryKey,
  address: p.address ?? "",
  description: p.description ?? "",
})

export function EditPointDialog({ tripId, point, onSuccess }: EditPointDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState<PlaceFormData>(() => fromPoint(point))

  // Reset form data from the latest point whenever the dialog opens
  const handleOpenChange = (next: boolean) => {
    if (next) setForm(fromPoint(point))
    setOpen(next)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setIsSubmitting(true)
    try {
      let location = { lat: point.latitude, lng: point.longitude }
      if (form.address !== (point.address ?? "") || form.city !== (point.city ?? "")) {
        const found = await geocodePlace(form)
        if (found) location = found
        else toast.warning("Endereço não encontrado no mapa; a localização foi mantida.")
      }
      const input = toPlaceInput(form)
      await api.places.update(tripId, point.id, {
        ...input,
        // Send empty strings so cleared optional fields are removed on the server.
        city: input.city ?? "",
        address: input.address ?? "",
        description: input.description ?? "",
        location,
      })
      toast.success("Ponto de interesse atualizado!")
      setOpen(false)
      await onSuccess()
    } catch (error) {
      toast.error(errorMessage(error, "Erro ao atualizar ponto."))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-primary"
          onClick={(e) => e.stopPropagation()}
          title="Editar ponto"
          aria-label="Editar ponto"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Editar Ponto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <PlaceFormFields
            value={form}
            onChange={setForm}
            addressHint="Alterar o endereço ou a cidade atualiza a localização no mapa."
          />
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
