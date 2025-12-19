"use client"

import { useState, useMemo } from "react"
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
import { Input } from "@/components/ui/input"
import { Plus, Search } from "lucide-react"
import { toast } from "sonner"

interface Point {
  id: string
  name: string
  city?: string | null
}

interface AddPointToItineraryDialogProps {
  itineraryId: string
  tripId: string
  points: Point[]
  onSuccess: () => void
}

export function AddPointToItineraryDialog({ itineraryId, tripId, points, onSuccess }: AddPointToItineraryDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedPointId, setSelectedPointId] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCity, setSelectedCity] = useState<string>("all")

  const cities = useMemo(() => {
    const citiesSet = new Set(points.map(p => p.city).filter(Boolean))
    return Array.from(citiesSet).sort()
  }, [points])

  const filteredPoints = useMemo(() => {
    return points.filter(point => {
      const matchesSearch = point.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCity = selectedCity === "all" || point.city === selectedCity
      return matchesSearch && matchesCity
    })
  }, [points, searchTerm, selectedCity])

  const handleSubmit = async () => {
    if (!selectedPointId) return

    try {
      setIsSubmitting(true)
      const response = await fetch(`/api/itineraries/${itineraryId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pointId: selectedPointId, tripId }),
      })

      if (!response.ok) throw new Error("Failed to add point")

      toast.success("Ponto adicionado ao roteiro!")
      setOpen(false)
      setSelectedPointId("")
      setSearchTerm("")
      setSelectedCity("all")
      onSuccess()
    } catch (error) {
      toast.error("Erro ao adicionar ponto.")
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full mt-2">
          <Plus className="mr-2 h-3 w-3" />
          Adicionar Ponto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Ponto ao Roteiro</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar ponto..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Cidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {cities.map(city => (
                  <SelectItem key={city as string} value={city as string}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Select value={selectedPointId} onValueChange={setSelectedPointId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um ponto" />
            </SelectTrigger>
            <SelectContent>
              {filteredPoints.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground text-center">Nenhum ponto encontrado</div>
              ) : (
                filteredPoints.map((point) => (
                  <SelectItem key={point.id} value={point.id}>
                    {point.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button onClick={handleSubmit} disabled={!selectedPointId || isSubmitting} className="w-full">
            Adicionar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
