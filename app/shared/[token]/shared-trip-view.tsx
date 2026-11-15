"use client"

import { useMemo, useState } from "react"
import { useJsApiLoader } from "@react-google-maps/api"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Calendar as CalendarIcon, Layout, List as ListIcon, Map as MapIcon, MapPin } from "lucide-react"
import { Map } from "@/components/features/map/map"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CATEGORY_LABELS } from "@/lib/domain/categories"
import type { PublicTripDto } from "@/lib/domain/dto"
import { cn } from "@/lib/utils"

const libraries: "places"[] = ["places"]
type ViewMode = "split" | "map" | "list"

const VIEW_BUTTONS: { mode: ViewMode; label: string; Icon: typeof ListIcon }[] = [
  { mode: "list", label: "Lista", Icon: ListIcon },
  { mode: "split", label: "Dividido", Icon: Layout },
  { mode: "map", label: "Mapa", Icon: MapIcon },
]

export function SharedTripView({ trip }: { trip: PublicTripDto }) {
  const [viewMode, setViewMode] = useState<ViewMode>("split")
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
  })

  // The public DTO has no ids; the map only needs stable keys.
  const points = useMemo(
    () =>
      trip.places.map((p, i) => ({
        id: `p${i}`,
        name: p.name,
        category: p.category,
        latitude: p.location.lat,
        longitude: p.location.lng,
        visited: p.visited,
      })),
    [trip.places],
  )

  return (
    <div className="h-[100dvh] flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        <div
          className={cn(
            "border-r bg-background flex flex-col",
            viewMode === "map" ? "hidden" : viewMode === "list" ? "w-full h-full" : "w-full md:w-1/3 h-1/2 md:h-full order-2 md:order-1",
          )}
        >
          <div className="p-4 md:p-6 border-b">
            <div className="flex justify-between items-start gap-4">
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold mb-2 break-words">{trip.name}</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarIcon className="h-4 w-4" />
                  {trip.startDate ? format(parseISO(trip.startDate), "dd/MM/yyyy") : "Data não definida"}
                  {trip.endDate && ` - ${format(parseISO(trip.endDate), "dd/MM/yyyy")}`}
                </div>
              </div>
              <div className="flex items-center border rounded-md p-1 gap-1 shrink-0" role="group" aria-label="Modo de visualização">
                {VIEW_BUTTONS.map(({ mode, label, Icon }) => (
                  <Button
                    key={mode}
                    variant={viewMode === mode ? "secondary" : "ghost"}
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setViewMode(mode)}
                    title={label}
                    aria-label={label}
                    aria-pressed={viewMode === mode}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <Tabs defaultValue="itinerary" className="flex-1 flex flex-col min-h-0">
            <div className="px-4 md:px-6 pt-4">
              <TabsList className="w-full">
                <TabsTrigger value="itinerary" className="flex-1">Roteiro</TabsTrigger>
                <TabsTrigger value="places" className="flex-1">Lugares</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="places" className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 min-h-0">
              {trip.places.map((place, i) => (
                <Card key={i}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-primary mt-1 shrink-0" />
                    <div>
                      <h3 className="font-medium">{place.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {CATEGORY_LABELS[place.category]}
                        {place.city && ` · ${place.city}`}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {trip.places.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum lugar salvo.</p>}
            </TabsContent>

            <TabsContent value="itinerary" className="flex-1 p-4 md:p-6 overflow-y-auto min-h-0">
              <div className="space-y-6">
                {trip.days.map((day) => (
                  <div key={day.date} className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2 capitalize">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      {format(parseISO(day.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </h3>
                    <ol className="pl-4 border-l-2 border-muted space-y-4">
                      {day.stops.map((stop, i) => (
                        <li key={i} className="relative">
                          <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-primary" />
                          <div className="text-sm font-medium">
                            {stop.time && <span className="text-muted-foreground mr-2">{stop.time}</span>}
                            {stop.place.name}
                          </div>
                          <div className="text-xs text-muted-foreground">{CATEGORY_LABELS[stop.place.category]}</div>
                        </li>
                      ))}
                      {day.stops.length === 0 && <li className="text-sm text-muted-foreground italic">Nenhum ponto neste dia</li>}
                    </ol>
                  </div>
                ))}
                {trip.days.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum roteiro definido</p>}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div
          className={cn(
            "bg-muted relative",
            viewMode === "list" ? "hidden" : viewMode === "map" ? "w-full h-full order-1" : "w-full md:w-2/3 h-1/2 md:h-full order-1 md:order-2",
          )}
        >
          <Map points={points} isLoaded={isLoaded} loadError={loadError} />
        </div>
      </div>
    </div>
  )
}
