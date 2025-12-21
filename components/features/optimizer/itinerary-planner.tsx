"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Calendar as CalendarIcon, Plus, Trash2, Map as MapIcon, ArrowUp, ArrowDown, Footprints, Bus, Car, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getCategoryConfig } from "@/lib/constants"

import { AddPointToItineraryDialog } from "./add-point-dialog"

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

interface ItineraryItem {
  id: string
  point: Point
  order: number
}

interface Itinerary {
  id: string
  date: string
  items: ItineraryItem[]
}

interface ItineraryPlannerProps {
  tripId: string
  points: Point[]
  itineraries: Itinerary[]
  onUpdate: () => void
  onOptimize: (items: ItineraryItem[], mode: string) => void
}

export function ItineraryPlanner({ tripId, points, itineraries, onUpdate, onOptimize }: ItineraryPlannerProps) {
  const [date, setDate] = useState<Date>()
  const [isCreating, setIsCreating] = useState(false)
  const [travelMode, setTravelMode] = useState<string>("WALKING")

  const handleCreateItinerary = async () => {
    if (!date) return

    try {
      setIsCreating(true)
      const response = await fetch(`/api/trips/${tripId}/itineraries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: date.toISOString() }),
      })

      if (!response.ok) throw new Error("Failed to create itinerary")

      toast.success("Dia adicionado ao roteiro!")
      onUpdate()
      setDate(undefined)
    } catch (error) {
      toast.error("Erro ao adicionar dia.")
      console.error(error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteItem = async (itineraryId: string, itemId: string) => {
    if (!confirm("Remover este ponto do roteiro?")) return

    try {
      const response = await fetch(`/api/itineraries/${itineraryId}/items/${itemId}?tripId=${tripId}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete item")

      toast.success("Ponto removido do roteiro!")
      onUpdate()
    } catch (error) {
      toast.error("Erro ao remover ponto.")
      console.error(error)
    }
  }

  const openInGoogleMaps = (items: ItineraryItem[], mode: string) => {
    if (items.length < 2) return;

    const origin = `${items[0].point.latitude},${items[0].point.longitude}`;
    const destination = `${items[items.length - 1].point.latitude},${items[items.length - 1].point.longitude}`;
    
    const waypoints = items.slice(1, -1).map(item => `${item.point.latitude},${item.point.longitude}`).join('|');
    
    let mapMode = 'driving';
    if (mode === 'WALKING') mapMode = 'walking';
    if (mode === 'TRANSIT') mapMode = 'transit';
    
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=${mapMode}`;
    if (waypoints) {
      url += `&waypoints=${waypoints}`;
    }
    
    window.open(url, '_blank');
  }

  const handleMoveItem = async (itineraryId: string, items: ItineraryItem[], index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === items.length - 1)) return

    const newItems = [...items]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    
    // Swap
    const temp = newItems[index]
    newItems[index] = newItems[targetIndex]
    newItems[targetIndex] = temp

    // Update order property
    const updatedItems = newItems.map((item, idx) => ({
      ...item,
      order: idx + 1
    }))

    try {
      const response = await fetch(`/api/itineraries/${itineraryId}/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: updatedItems, tripId }),
      })

      if (!response.ok) throw new Error("Failed to reorder items")

      onUpdate()
    } catch (error) {
      toast.error("Erro ao reordenar pontos.")
      console.error(error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full sm:w-[240px] justify-start text-left font-normal",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP", { locale: ptBR }) : <span>Adicionar dia</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <Button onClick={handleCreateItinerary} disabled={!date || isCreating} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Adicionar
        </Button>
      </div>

      <div className="space-y-4">
        {itineraries.map((itinerary) => (
          <Card key={itinerary.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex justify-between items-center">
                {format(new Date(itinerary.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
                <Button variant="ghost" size="sm">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {itinerary.items.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-md">
                  Nenhum ponto neste dia.
                  <br />
                  Arraste pontos para cá ou clique em adicionar.
                </div>
              ) : (
                <div className="space-y-2">
                  {itinerary.items.map((item, index) => {
                    const categoryConfig = getCategoryConfig(item.point.category || undefined);
                    return (
                    <div 
                      key={item.id || index} 
                      className="flex items-center gap-2 p-2 bg-muted rounded-md text-sm group"
                      style={{ borderLeft: `3px solid ${categoryConfig.color}` }}
                    >
                      <span className="font-mono text-xs bg-background px-1.5 py-0.5 rounded border">
                        {index + 1}
                      </span>
                      <span className="flex-1 truncate">{item.point.name}</span>
                      <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMoveItem(itinerary.id, itinerary.items, index, 'up')}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMoveItem(itinerary.id, itinerary.items, index, 'down')}
                          disabled={index === itinerary.items.length - 1}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteItem(itinerary.id, item.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )})}
                </div>
              )}
              <AddPointToItineraryDialog 
                itineraryId={itinerary.id} 
                tripId={tripId}
                points={points} 
                onSuccess={onUpdate} 
              />
              <div className="mt-4 flex justify-end gap-2">
                <Select value={travelMode} onValueChange={setTravelMode}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WALKING">
                      <div className="flex items-center gap-2">
                        <Footprints className="h-4 w-4" />
                        <span>A pé</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="TRANSIT">
                      <div className="flex items-center gap-2">
                        <Bus className="h-4 w-4" />
                        <span>Transporte</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="DRIVING">
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4" />
                        <span>Carro</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  size="sm" 
                  variant="secondary" 
                  onClick={() => onOptimize(itinerary.items, travelMode)}
                  disabled={itinerary.items.length < 2}
                >
                  <MapIcon className="mr-2 h-3 w-3" />
                  Otimizar
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => openInGoogleMaps(itinerary.items, travelMode)}
                  disabled={itinerary.items.length < 2}
                  title="Abrir rota no Google Maps"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
