"use client"

import { useState, useCallback } from "react"
import { Navbar } from "@/components/navbar"
import { Map } from "@/components/features/map/map"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useQuery } from "@tanstack/react-query"
import { Loader2, MapPin, Calendar as CalendarIcon, Plus, MessageSquare, X, AlertTriangle, Search, Layout, Map as MapIcon, List as ListIcon, Trash2, ExternalLink, CheckCircle2, Circle } from "lucide-react"
import { useParams } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useJsApiLoader } from "@react-google-maps/api"
import { ChatPanel } from "@/components/features/chat/chat-panel"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { getCategoryConfig } from "@/lib/constants"

interface Point {
  id: string
  name: string
  description: string | null
  category: string | null
  address: string | null
  city?: string | null
  latitude: number
  longitude: number
  visited?: boolean
}

import { ItineraryPlanner } from "@/components/features/optimizer/itinerary-planner"
import { CreatePointDialog } from "@/components/features/optimizer/create-point-dialog"
import { AddToItineraryDialog } from "@/components/features/optimizer/add-to-itinerary-dialog"

interface ItineraryItem {
  id: string
  point: Point
  order: number
  visited?: boolean
}

interface Itinerary {
  id: string
  date: string
  items: ItineraryItem[]
}

interface Trip {
  id: string
  name: string
  description: string | null
  startDate: string | null
  endDate: string | null
  points: Point[]
  itineraries: Itinerary[]
}

import { ShareDialog } from "@/components/features/share/share-dialog"

const libraries: ("places" | "drawing" | "geometry" | "visualization")[] = ["places"];

export default function TripDetailPage() {
  const params = useParams()
  const tripId = params.id as string
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [activePoint, setActivePoint] = useState<Point | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [viewMode, setViewMode] = useState<'split' | 'map' | 'list'>('split')
  const [filteredMapPoints, setFilteredMapPoints] = useState<Point[] | null>(null)

  const { isLoaded: isScriptLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
  })

  if (loadError) {
    toast.error("Erro ao carregar o Google Maps. Verifique a chave de API.");
    console.error("Google Maps Load Error:", loadError);
  }

  const { data: trip, isLoading, refetch } = useQuery<Trip>({
    queryKey: ["trip", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}`)
      if (!res.ok) throw new Error("Failed to fetch trip")
      return res.json()
    },
  })

  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)
  const [transitSegments, setTransitSegments] = useState<google.maps.DirectionsResult[] | null>(null)

  const handleOptimize = useCallback((items: ItineraryItem[], mode: string = 'DRIVING') => {
    console.log("handleOptimize called with items:", items, "mode:", mode)
    
    // Reset previous results
    setDirections(null)
    setTransitSegments(null)
    
    // Filter out items with missing points or invalid coordinates
    const validItems = items.filter(item => 
      item.point && 
      typeof item.point.latitude === 'number' && 
      typeof item.point.longitude === 'number'
    )

    if (validItems.length < 2) {
      console.log("Not enough valid items to optimize")
      toast.error("É necessário pelo menos 2 pontos com localização válida para otimizar.")
      return
    }
    if (!isScriptLoaded) {
      console.log("Google Maps script not loaded")
      return
    }

    const directionsService = new google.maps.DirectionsService()

    // Special handling for TRANSIT with multiple points (Google Maps API limitation)
    if (mode === 'TRANSIT' && validItems.length > 2) {
      const promises = []
      
      for (let i = 0; i < validItems.length - 1; i++) {
        const origin = validItems[i].point
        const destination = validItems[i+1].point
        
        const promise = new Promise<google.maps.DirectionsResult>((resolve, reject) => {
          directionsService.route({
            origin: { lat: origin.latitude, lng: origin.longitude },
            destination: { lat: destination.latitude, lng: destination.longitude },
            travelMode: google.maps.TravelMode.TRANSIT,
          }, (result, status) => {
            if (status === google.maps.DirectionsStatus.OK && result) {
              resolve(result)
            } else {
              reject(status)
            }
          })
        })
        promises.push(promise)
      }

      Promise.all(promises)
        .then((results) => {
          setTransitSegments(results)
          if (viewMode === 'list') setViewMode('map')
        })
        .catch((error) => {
          console.error("Error fetching transit segments:", error)
          toast.error(`Erro ao calcular rota de transporte público: ${error}`)
        })
      
      return
    }

    const origin = validItems[0].point
    const destination = validItems[validItems.length - 1].point
    
    console.log("Optimizing route from", origin.name, "to", destination.name)

    const waypoints = validItems.slice(1, -1).map(item => ({
      location: { lat: item.point.latitude, lng: item.point.longitude },
      stopover: true
    }))

    // Transit does not support waypoints optimization
    const optimizeWaypoints = mode !== 'TRANSIT'

    // Map string mode to Google Maps constant
    let travelMode = google.maps.TravelMode.DRIVING
    if (mode === 'WALKING') travelMode = google.maps.TravelMode.WALKING
    if (mode === 'TRANSIT') travelMode = google.maps.TravelMode.TRANSIT
    if (mode === 'BICYCLING') travelMode = google.maps.TravelMode.BICYCLING

    directionsService.route(
      {
        origin: { lat: origin.latitude, lng: origin.longitude },
        destination: { lat: destination.latitude, lng: destination.longitude },
        waypoints: mode === 'TRANSIT' ? undefined : waypoints,
        optimizeWaypoints: optimizeWaypoints,
        travelMode: travelMode,
      },
      (result, status) => {
        console.log("Directions API response status:", status)
        if (status === google.maps.DirectionsStatus.OK) {
          setDirections(result)
          if (viewMode === 'list') setViewMode('map')
        } else {
          console.error(`error fetching directions: ${status}`, result)
          if (status === 'ZERO_RESULTS' && mode === 'TRANSIT') {
             toast.error(`Não foi possível encontrar rota de transporte público.`)
          } else {
             toast.error(`Erro ao otimizar rota: ${status}`)
          }
        }
      }
    )
  }, [isScriptLoaded, viewMode])

  const handleDeletePoint = async (pointId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
    if (!confirm("Tem certeza que deseja remover este ponto?")) return

    try {
      const response = await fetch(`/api/trips/${tripId}/points/${pointId}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete point")

      toast.success("Ponto removido!")
      refetch()
    } catch (error) {
      toast.error("Erro ao remover ponto.")
      console.error(error)
    }
  }

  const handleTogglePointVisited = async (pointId: string, currentVisited: boolean) => {
    try {
      const response = await fetch(`/api/trips/${tripId}/points/${pointId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visited: !currentVisited }),
      })

      if (!response.ok) throw new Error("Failed to update point")

      refetch()
    } catch (error) {
      toast.error("Erro ao atualizar status do ponto.")
      console.error(error)
    }
  }

  const handleViewItineraryOnMap = useCallback((items: ItineraryItem[]) => {
    const points = items.map(item => item.point);
    setFilteredMapPoints(points);
    if (viewMode === 'list') setViewMode('map');
    toast.info(`Visualizando ${points.length} pontos do roteiro no mapa.`);
  }, [viewMode]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!trip) {
    return <div>Viagem não encontrada</div>
  }

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden">
      <Navbar />
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Sidebar */}
        <div className={cn(
          "border-r bg-background flex flex-col transition-all duration-300 ease-in-out z-10",
          viewMode === 'map' ? 'hidden' : (viewMode === 'list' ? 'flex-1 h-full' : 'w-full md:w-1/3 h-[65%] md:h-full order-2 md:order-1')
        )}>
          <div className="p-6 border-b flex justify-between items-start">
            <div>
              <h1 className="text-lg md:text-2xl font-bold mb-2 line-clamp-1">{trip.name}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarIcon className="h-4 w-4" />
                {trip.startDate ? format(new Date(trip.startDate), "dd/MM/yyyy") : "Data não definida"}
                {trip.endDate && ` - ${format(new Date(trip.endDate), "dd/MM/yyyy")}`}
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <div className="flex bg-muted rounded-lg p-1 mr-2">
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode('list')}
                  title="Apenas Lista"
                >
                  <ListIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'split' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode('split')}
                  title="Dividido"
                >
                  <Layout className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'map' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode('map')}
                  title="Apenas Mapa"
                >
                  <MapIcon className="h-4 w-4" />
                </Button>
              </div>
              <ShareDialog tripId={trip.id} />
              <Button 
                variant={isChatOpen ? "secondary" : "outline"}
                size="icon"
                onClick={() => setIsChatOpen(!isChatOpen)}
                title="Assistente IA"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Tabs defaultValue="points" className="flex-1 flex flex-col min-h-0">
            <div className="px-6 pt-4">
              <TabsList className="w-full">
                <TabsTrigger value="points" className="flex-1">Pontos</TabsTrigger>
                <TabsTrigger value="itinerary" className="flex-1">Roteiro</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="points" className="flex-1 flex flex-col min-h-0 mt-2">
              <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <h2 className="font-semibold">Pontos de Interesse</h2>
                    <CreatePointDialog tripId={trip.id} onSuccess={refetch} />
                  </div>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar pontos..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-6">
                {(() => {
                  const filteredPoints = trip.points.filter(point => 
                    point.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    point.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    point.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    point.city?.toLowerCase().includes(searchTerm.toLowerCase())
                  )

                  // Group by city
                  const groupedPoints = filteredPoints.reduce((acc, point) => {
                    const city = point.city || "Outros"
                    if (!acc[city]) acc[city] = []
                    acc[city].push(point)
                    return acc
                  }, {} as Record<string, Point[]>)

                  return Object.entries(groupedPoints).map(([city, points]) => (
                    <div key={city} className="space-y-3">
                      <h3 className="text-sm font-medium text-muted-foreground sticky top-0 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
                        {city} ({points.length})
                      </h3>
                      {points.map((point) => {
                        const categoryConfig = getCategoryConfig(point.category || undefined);
                        const CategoryIcon = categoryConfig.icon;
                        const isVisited = point.visited || false;
                        
                        return (
                        <Card 
                          key={point.id} 
                          className={cn(
                            "cursor-pointer hover:bg-muted/50 transition-colors",
                            activePoint?.id === point.id && "border-primary bg-muted/50",
                            isVisited && "opacity-70 bg-muted/30"
                          )}
                          style={{ borderLeft: `4px solid ${isVisited ? '#9ca3af' : categoryConfig.color}` }}
                          onClick={() => {
                            setActivePoint(point)
                            if (viewMode === 'list') setViewMode('map')
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="mt-1">
                                {isVisited ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                ) : (
                                  <CategoryIcon className="h-4 w-4" style={{ color: categoryConfig.color }} />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between items-start">
                                  <h3 className={cn("font-medium", isVisited && "line-through text-muted-foreground")}>{point.name}</h3>
                                  <div className="flex items-center -mt-1 -mr-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-primary"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTogglePointVisited(point.id, isVisited);
                                      }}
                                      title={isVisited ? "Marcar como não visitado" : "Marcar como visitado"}
                                    >
                                      {isVisited ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <Circle className="h-4 w-4" />
                                      )}
                                    </Button>
                                    <AddToItineraryDialog 
                                      tripId={trip.id}
                                      pointId={point.id}
                                      itineraries={trip.itineraries}
                                      onSuccess={refetch}
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-primary"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(`https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`, '_blank');
                                      }}
                                      title="Abrir no Google Maps"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                      onClick={(e) => handleDeletePoint(point.id, e)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {point.description}
                                </p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {point.category && (
                                    <span 
                                      className="text-xs px-2 py-0.5 rounded-full text-white"
                                      style={{ backgroundColor: categoryConfig.color }}
                                    >
                                      {point.category}
                                    </span>
                                  )}
                                  {point.city && (
                                    <span className="text-xs border px-2 py-0.5 rounded-full text-muted-foreground">
                                      {point.city}
                                    </span>
                                  )}
                                </div>
                                {(point.latitude === 0 && point.longitude === 0) && (
                                  <div className="text-xs text-yellow-600 mt-2 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    Localização pendente
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )})}
                    </div>
                  ))
                })()}
                
                {trip.points.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    Nenhum ponto encontrado.
                  </div>
                )}
              </div>
              </div>
            </TabsContent>

            <TabsContent value="itinerary" className="flex-1 flex flex-col min-h-0 mt-2">
              <div className="flex-1 overflow-y-auto p-6 min-h-0">
                <ItineraryPlanner 
                  tripId={trip.id} 
                  points={trip.points} 
                  itineraries={trip.itineraries}
                  onUpdate={refetch}
                  onOptimize={handleOptimize}
                  onViewOnMap={handleViewItineraryOnMap}
                  onTogglePointVisited={handleTogglePointVisited}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Map Area */}
        <div className={cn(
          "bg-muted relative flex transition-all duration-300 ease-in-out",
          viewMode === 'list' ? 'hidden' : (viewMode === 'map' ? 'flex-1 h-full order-1' : 'h-[35%] md:h-full flex-none md:flex-1 order-1 md:order-2')
        )}>
          {viewMode === 'map' && (
            <div className="absolute top-4 left-4 z-10 bg-background/90 backdrop-blur-sm p-1 rounded-lg shadow-md border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('split')}
                className="gap-2"
              >
                <Layout className="h-4 w-4" />
                Mostrar Lista
              </Button>
            </div>
          )}
          <div className="flex-1 relative">
            {filteredMapPoints && (
              <div className="absolute top-4 left-4 z-10 bg-background/90 backdrop-blur p-2 rounded-md shadow-md border flex items-center gap-2">
                <span className="text-sm font-medium">Filtro ativo: {filteredMapPoints.length} pontos</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 text-muted-foreground hover:text-foreground"
                  onClick={() => setFilteredMapPoints(null)}
                >
                  <X className="h-3 w-3 mr-1" />
                  Limpar
                </Button>
              </div>
            )}
            <Map 
              points={filteredMapPoints || trip.points} 
              directions={directions} 
              transitSegments={transitSegments}
              isLoaded={isScriptLoaded}
              loadError={loadError}
              activePoint={activePoint}
            />
          </div>
        </div>
          
        {/* Chat Panel */}
        {isChatOpen && (
          <div className="fixed inset-0 z-50 w-full h-[100dvh] bg-background md:relative md:inset-auto md:w-[400px] md:h-full md:border-l md:shadow-none order-3">
            <div className="h-full flex flex-col">
              <div className="md:hidden p-2 flex justify-end border-b">
                <Button variant="ghost" size="icon" onClick={() => setIsChatOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ChatPanel tripId={trip.id} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
