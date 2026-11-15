"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { api, errorMessage } from "@/lib/client/api"
import { emptyPlaceForm, geocodePlace, PlaceFormFields, toPlaceInput, type PlaceFormData } from "./place-form-fields"

interface CreatePointDialogProps {
  tripId: string
  onSuccess: () => Promise<void> | void
}

export function CreatePointDialog({ tripId, onSuccess }: CreatePointDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState<PlaceFormData>(emptyPlaceForm)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setIsSubmitting(true)
    try {
      const location = await geocodePlace(form)
      if (!location) {
        toast.error("Não encontramos este lugar no mapa. Informe o endereço ou a cidade.")
        return
      }
      await api.places.create(tripId, { ...toPlaceInput(form), location })
      toast.success("Ponto de interesse criado!")
      setOpen(false)
      setForm(emptyPlaceForm)
      await onSuccess()
    } catch (error) {
      toast.error(errorMessage(error, "Erro ao criar ponto."))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Ponto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <PlaceFormFields value={form} onChange={setForm} />
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Criando..." : "Criar Ponto"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
