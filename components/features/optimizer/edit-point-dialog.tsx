"use client"

import { useState, useEffect } from "react"
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
import { Pencil } from "lucide-react"
import { toast } from "sonner"

interface Point {
  id: string
  name: string
  description: string | null
  category: string | null
  address: string | null
  city?: string | null
  latitude: number
  longitude: number
}

interface EditPointDialogProps {
  tripId: string
  point: Point
  onSuccess: () => void
}

export function EditPointDialog({ tripId, point, onSuccess }: EditPointDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: point.name,
    description: point.description || "",
    category: point.category || "",
    address: point.address || "",
    city: point.city || "",
  })

  // Reset form data when dialog opens with new point data
  useEffect(() => {
    if (open) {
      setFormData({
        name: point.name,
        description: point.description || "",
        category: point.category || "",
        address: point.address || "",
        city: point.city || "",
      })
    }
  }, [open, point])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name) return

    try {
      setIsSubmitting(true)
      
      let lat = point.latitude
      let lng = point.longitude

      // Re-geocode if address changed
      const addressChanged = formData.address !== (point.address || "")
      
      if (addressChanged && typeof window !== 'undefined' && window.google && window.google.maps) {
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
          toast.error("Erro ao geocodificar o endereço. Coordenadas não foram atualizadas.")
        }
      }

      const response = await fetch(`/api/trips/${tripId}/points/${point.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          category: formData.category || null,
          address: formData.address || null,
          city: formData.city || null,
          latitude: lat,
          longitude: lng
        }),
      })

      if (!response.ok) throw new Error("Failed to update point")

      toast.success("Ponto de interesse atualizado!")
      setOpen(false)
      onSuccess()
    } catch (error) {
      toast.error("Erro ao atualizar ponto.")
      console.error(error)
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
          title="Editar ponto"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Editar Ponto</DialogTitle>
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
            <p className="text-xs text-muted-foreground">
              Alterar o endereço irá atualizar a localização no mapa.
            </p>
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
            {isSubmitting ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
