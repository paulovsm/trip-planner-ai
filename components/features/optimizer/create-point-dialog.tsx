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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus } from "lucide-react"
import { toast } from "sonner"

interface CreatePointDialogProps {
  tripId: string
  onSuccess: () => void
}

export function CreatePointDialog({ tripId, onSuccess }: CreatePointDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    address: "",
    city: "",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name) return

    try {
      setIsSubmitting(true)
      
      let lat = 0
      let lng = 0

      // Client-side geocoding
      if (typeof window !== 'undefined' && window.google && window.google.maps) {
        const geocoder = new window.google.maps.Geocoder()
        const addressToGeocode = formData.address || `${formData.name}, ${formData.city || ''}`
        
        try {
          const result = await geocoder.geocode({ address: addressToGeocode })
          if (result.results && result.results.length > 0) {
            const location = result.results[0].geometry.location
            lat = location.lat()
            lng = location.lng()
          }
        } catch (geoError) {
          console.error("Geocoding failed:", geoError)
          // Continue without coordinates if geocoding fails
        }
      }

      const response = await fetch(`/api/trips/${tripId}/points`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          latitude: lat,
          longitude: lng
        }),
      })

      if (!response.ok) throw new Error("Failed to create point")

      toast.success("Ponto de interesse criado!")
      setOpen(false)
      setFormData({
        name: "",
        description: "",
        category: "",
        address: "",
        city: "",
      })
      onSuccess()
    } catch (error) {
      toast.error("Erro ao criar ponto.")
      console.error(error)
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
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Ex: Torre Eiffel"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Cidade</Label>
            <Input
              id="city"
              name="city"
              value={formData.city}
              onChange={handleChange}
              placeholder="Ex: Paris"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Input
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              placeholder="Ex: Monumento, Restaurante"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Endereço</Label>
            <Input
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Endereço completo"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Breve descrição do local"
            />
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Criando..." : "Criar Ponto"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
