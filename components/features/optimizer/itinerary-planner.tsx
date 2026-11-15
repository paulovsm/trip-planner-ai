"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, isBefore, parseISO, startOfDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Calendar as CalendarIcon, Plus, Trash2, Map as MapIcon, ArrowUp, ArrowDown, Footprints, Bike, Bus, Car, ExternalLink, Eye, CheckCircle2, Circle, ChevronDown, ChevronRight, EyeOff } from "lucide-react"
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
import { api, errorMessage } from "@/lib/client/api"
import type { LegacyItem as ItineraryItem, LegacyItinerary as Itinerary, LegacyPoint as Point } from "@/lib/client/legacy-view"
import type { TravelMode } from "@/lib/domain/schemas"

import { AddPointToItineraryDialog } from "./add-point-dialog"

interface ItineraryPlannerProps {
  tripId: string
  points: Point[]
  itineraries: Itinerary[]
  onUpdate: () => Promise<void> | void
  onOptimize: (items: ItineraryItem[], mode: string) => void
  onViewOnMap: (items: ItineraryItem[]) => void
  onTogglePointVisited: (pointId: string, currentVisited: boolean) => void
  onPointClick?: (point: Point) => void
}

export function ItineraryPlanner({ tripId, points, itineraries, onUpdate, onOptimize, onViewOnMap, onTogglePointVisited, onPointClick }: ItineraryPlannerProps) {
  const [date, setDate] = useState<Date>()
  const [isCreating, setIsCreating] = useState(false)
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set())

  const pastItineraryIds = useMemo(() => {
    const today = startOfDay(new Date())
    return new Set(
      itineraries
        .filter((itinerary) => isBefore(parseISO(itinerary.date), today))
        .map((itinerary) => itinerary.id)
    )
  }, [itineraries])

  const toggleDayCollapsed = (itineraryId: string) => {
    setCollapsedDays((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(itineraryId)) {
        newSet.delete(itineraryId)
      } else {
        newSet.add(itineraryId)
      }
      return newSet
    })
  }

  const collapseAllPastDays = () => {
    setCollapsedDays(new Set(pastItineraryIds))
  }

  const expandAllDays = () => {
    setCollapsedDays(new Set())
  }

  const hasCollapsedDays = collapsedDays.size > 0
  const hasPastDays = pastItineraryIds.size > 0

  const handleCreateItinerary = async () => {
    if (!date) return

    try {
      setIsCreating(true)
      // Calendar date in local time (no UTC shift).
      await api.days.create(tripId, { date: format(date, "yyyy-MM-dd") })
      toast.success("Dia adicionado ao roteiro!")
      await onUpdate()
      setDate(undefined)
    } catch (error) {
      toast.error(errorMessage(error, "Erro ao adicionar dia."))
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteItem = async (itineraryId: string, itemId: string) => {
    if (!confirm("Remover este ponto do roteiro?")) return

    try {
      await api.days.removeStop(tripId, itineraryId, itemId)
      toast.success("Ponto removido do roteiro!")
      await onUpdate()
    } catch (error) {
      toast.error(errorMessage(error, "Erro ao remover ponto."))
    }
  }

  const handleDeleteDay = async (itineraryId: string) => {
    if (!confirm("Excluir este dia do roteiro? Os pontos continuam salvos na viagem.")) return
    try {
      await api.days.remove(tripId, itineraryId)
      toast.success("Dia excluído.")
      await onUpdate()
    } catch (error) {
      toast.error(errorMessage(error, "Erro ao excluir dia."))
    }
  }

  const handleTravelModeChange = async (itineraryId: string, mode: TravelMode) => {
    try {
      await api.days.update(tripId, itineraryId, { travelMode: mode })
      await onUpdate()
    } catch (error) {
      toast.error(errorMessage(error, "Erro ao alterar o modo de deslocamento."))
    }
  }

  const openInGoogleMaps = (items: ItineraryItem[], mode: TravelMode) => {
    if (items.length < 2) return;

    const origin = `${items[0].point.latitude},${items[0].point.longitude}`;
    const destination = `${items[items.length - 1].point.latitude},${items[items.length - 1].point.longitude}`;
    
    const waypoints = items.slice(1, -1).map(item => `${item.point.latitude},${item.point.longitude}`).join('|');
    
    const mapMode = ({ WALK: "walking", BICYCLE: "bicycling", DRIVE: "driving", TRANSIT: "transit" } as const)[mode];
    
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=${mapMode}`;
    if (waypoints) {
      url += `&waypoints=${waypoints}`;
    }
    
    window.open(url, '_blank');
  }

  const handleMoveItem = async (itineraryId: string, items: ItineraryItem[], index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === items.length - 1)) return
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    try {
      // Operation-based move (ADR-0001): safe with concurrent co-editors.
      await api.days.updateStop(tripId, itineraryId, items[index].id, { toIndex: targetIndex })
      await onUpdate()
    } catch (error) {
      toast.error(errorMessage(error, "Erro ao reordenar pontos."))
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
              locale={ptBR}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <Button onClick={handleCreateItinerary} disabled={!date || isCreating} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Adicionar
        </Button>
        {hasPastDays && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={hasCollapsedDays ? expandAllDays : collapseAllPastDays}
            className="w-full sm:w-auto"
          >
            {hasCollapsedDays ? (
              <Eye className="mr-2 h-4 w-4" />
            ) : (
              <EyeOff className="mr-2 h-4 w-4" />
            )}
            {hasCollapsedDays ? "Expandir todos" : "Ocultar dias passados"}
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {itineraries.map((itinerary) => {
          const isCollapsed = collapsedDays.has(itinerary.id)
          const isPastDay = pastItineraryIds.has(itinerary.id)
          
          return (
          <Card key={itinerary.id} className={cn(isPastDay && "opacity-80")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex justify-between items-center gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => toggleDayCollapsed(itinerary.id)}
                    title={isCollapsed ? "Expandir dia" : "Ocultar dia"}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                  <span className={cn(isPastDay && "text-muted-foreground")}>
                    {format(parseISO(itinerary.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
                  </span>
                  {isPastDay && (
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                      Passado
                    </span>
                  )}
                  {isCollapsed && itinerary.items.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({itinerary.items.length} {itinerary.items.length === 1 ? 'ponto' : 'pontos'})
                    </span>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDeleteDay(itinerary.id)} title="Excluir dia" aria-label="Excluir dia">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardTitle>
            </CardHeader>
            {!isCollapsed && (
            <CardContent>
              {itinerary.items.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-md">
                  Nenhum ponto neste dia.
                  <br />
                  Use o botão abaixo para adicionar pontos.
                </div>
              ) : (
                <div className="space-y-2">
                  {itinerary.items.map((item, index) => {
                    if (!item?.point) return null;
                    const categoryConfig = getCategoryConfig(item.point.categoryKey);
                    const isVisited = item.point.visited || false;
                    return (
                    <div 
                      key={item.id || index} 
                      className={cn(
                        "flex items-center gap-2 p-2 bg-muted rounded-md text-sm group transition-colors cursor-pointer hover:bg-muted/70",
                        isVisited && "bg-muted/50 opacity-70"
                      )}
                      style={{ borderLeft: `3px solid ${isVisited ? '#9ca3af' : categoryConfig.color}` }}
                      onClick={() => onPointClick?.(item.point)}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={(e) => { e.stopPropagation(); onTogglePointVisited(item.point.id, isVisited); }}
                        title={isVisited ? "Marcar como não visitado" : "Marcar como visitado"}
                      >
                        {isVisited ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                      <span className="font-mono text-xs bg-background px-1.5 py-0.5 rounded border">
                        {index + 1}
                      </span>
                      <span className={cn("flex-1 truncate", isVisited && "line-through text-muted-foreground")}>{item.point.name}</span>
                      <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => { e.stopPropagation(); handleMoveItem(itinerary.id, itinerary.items, index, 'up'); }}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => { e.stopPropagation(); handleMoveItem(itinerary.id, itinerary.items, index, 'down'); }}
                          disabled={index === itinerary.items.length - 1}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); handleDeleteItem(itinerary.id, item.id); }}
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
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Select value={itinerary.travelMode} onValueChange={(v) => handleTravelModeChange(itinerary.id, v as TravelMode)}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WALK">
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
                    <SelectItem value="BICYCLE">
                      <div className="flex items-center gap-2">
                        <Bike className="h-4 w-4" />
                        <span>Bicicleta</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="DRIVE">
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
                  onClick={() => onOptimize(itinerary.items, itinerary.travelMode)}
                  disabled={itinerary.items.length < 2}
                >
                  <MapIcon className="mr-2 h-3 w-3" />
                  Otimizar
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => openInGoogleMaps(itinerary.items, itinerary.travelMode)}
                  disabled={itinerary.items.length < 2}
                  title="Abrir rota no Google Maps"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => onViewOnMap(itinerary.items)}
                  disabled={itinerary.items.length === 0}
                  title="Visualizar no mapa"
                >
                  <Eye className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
            )}
          </Card>
        )})}
      </div>
    </div>
  )
}
