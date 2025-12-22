"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { Map } from "@/components/features/map/map"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, MapPin, Calendar as CalendarIcon, User, Layout, Map as MapIcon, List as ListIcon } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useJsApiLoader } from "@react-google-maps/api"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Point {
  id: string
  name: string
  description: string | null
  category: string | null
  address: string | null
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

interface Trip {
  id: string
  name: string
  description: string | null
  startDate: string | null
  endDate: string | null
  points: Point[]
  itineraries: Itinerary[]
  user: {
    name: string | null
    image: string | null
  }
}

const libraries: ("places" | "drawing" | "geometry" | "visualization")[] = ["places"];

export default function SharedTripPage() {
  const params = useParams()
  const token = params.token as string
  const [trip, setTrip] = useState<Trip | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'split' | 'map' | 'list'>('split')

  const { isLoaded: isScriptLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
  })

  useEffect(() => {
    const fetchTrip = async () => {
      try {
        const res = await fetch(`/api/shared/${token}`)
        if (!res.ok) {
          if (res.status === 404) throw new Error("Viagem não encontrada ou link inválido")
          if (res.status === 410) throw new Error("Este link expirou")
          throw new Error("Erro ao carregar viagem")
        }
        const data = await res.json()
        setTrip(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }

    if (token) {
      fetchTrip()
    }
  }, [token])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <h1 className="text-2xl font-bold mb-2">Ops!</h1>
        <p className="text-muted-foreground">{error || "Viagem não encontrada"}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col h-screen">
      <Navbar />
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Sidebar */}
        <div className={cn(
          "border-r bg-background flex flex-col transition-all duration-300 ease-in-out",
          viewMode === 'map' ? 'hidden' : (viewMode === 'list' ? 'w-full h-full' : 'w-full md:w-1/3 h-1/2 md:h-full order-2 md:order-1')
        )}>
          <div className="p-4 md:p-6 border-b">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={trip.user.image || ""} />
                  <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                </Avatar>
                <div className="text-sm text-muted-foreground">
                  Viagem de <span className="font-medium text-foreground">{trip.user.name}</span>
                </div>
              </div>
              
              {/* View Mode Toggles (Desktop) */}
              <div className="hidden md:flex items-center border rounded-md p-1 gap-1">
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode('list')}
                  title="Lista Completa"
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
                  title="Mapa Completo"
                >
                  <MapIcon className="h-4 w-4" />
                </Button>
              </div>

              {/* View Mode Toggles (Mobile) */}
              <div className="flex md:hidden items-center border rounded-md p-1 gap-1">
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode('list')}
                >
                  <ListIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'split' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode('split')}
                >
                  <Layout className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'map' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode('map')}
                >
                  <MapIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <h1 className="text-xl md:text-2xl font-bold mb-2">{trip.name}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarIcon className="h-4 w-4" />
              {trip.startDate ? format(new Date(trip.startDate), "dd/MM/yyyy") : "Data não definida"}
              {trip.endDate && ` - ${format(new Date(trip.endDate), "dd/MM/yyyy")}`}
            </div>
          </div>

          <Tabs defaultValue="points" className="flex-1 flex flex-col min-h-0">
            <div className="px-4 md:px-6 pt-4">
              <TabsList className="w-full">
                <TabsTrigger value="points" className="flex-1">Pontos</TabsTrigger>
                <TabsTrigger value="itinerary" className="flex-1">Roteiro</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="points" className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 min-h-0">
              <div className="space-y-3">
                {trip.points.map((point) => (
                  <Card key={point.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          <MapPin className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-medium">{point.name}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {point.description}
                          </p>
                          {point.category && (
                            <span className="text-xs bg-secondary px-2 py-0.5 rounded-full mt-2 inline-block">
                              {point.category}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="itinerary" className="flex-1 p-4 md:p-6 overflow-y-auto min-h-0">
              <div className="space-y-6">
                {trip.itineraries.map((itinerary) => (
                  <div key={itinerary.id} className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      {format(new Date(itinerary.date), "dd 'de' MMMM", { locale: ptBR })}
                    </h3>
                    <div className="pl-4 border-l-2 border-muted space-y-4">
                      {itinerary.items.map((item) => {
                        if (!item?.point) return null;
                        return (
                        <div key={item.id} className="relative">
                          <div className="absolute -left-[21px] top-0 w-3 h-3 rounded-full bg-primary" />
                          <div className="text-sm font-medium">{item.point.name}</div>
                          {item.point.category && (
                            <div className="text-xs text-muted-foreground">{item.point.category}</div>
                          )}
                        </div>
                      )})}
                      {itinerary.items.length === 0 && (
                        <div className="text-sm text-muted-foreground italic">
                          Nenhum ponto neste dia
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {trip.itineraries.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    Nenhum roteiro definido
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Map Area */}
        <div className={cn(
          "bg-muted relative transition-all duration-300 ease-in-out",
          viewMode === 'list' ? 'hidden' : (viewMode === 'map' ? 'w-full h-full order-1' : 'w-full md:w-2/3 h-1/2 md:h-full order-1 md:order-2')
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
                Voltar
              </Button>
            </div>
          )}
          <Map points={trip.points} isLoaded={isScriptLoaded} />
        </div>
      </div>
    </div>
  )
}
