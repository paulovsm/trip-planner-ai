"use client"

import { useState, useCallback } from "react"
import { DocumentImporter } from "@/components/features/importer/document-importer"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, Save, MapPin, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useJsApiLoader } from "@react-google-maps/api"

interface POI {
  name: string
  description: string
  category: string
  address: string
  city?: string
  latitude?: number
  longitude?: number
}

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ["places"]

export default function NewTripPage() {
  const [pois, setPois] = useState<POI[]>([])
  const [tripName, setTripName] = useState("")
  const [isGeocoding, setIsGeocoding] = useState(false)
  const router = useRouter()

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
  })

  const geocodeClientSide = useCallback((geocoder: google.maps.Geocoder, address: string): Promise<{lat: number, lng: number} | null> => {
    return new Promise((resolve) => {
      geocoder.geocode({ address }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          resolve({
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng()
          })
        } else {
          console.warn(`Geocoding failed for ${address}: ${status}`)
          resolve(null)
        }
      })
    })
  }, [])

  const handleImport = async (data: { pois: POI[] }) => {
    if (!isLoaded) {
      toast.error("Google Maps API ainda não carregou. Tente novamente em instantes.")
      setPois((prev) => [...prev, ...data.pois])
      return
    }

    setIsGeocoding(true)
    const geocoder = new google.maps.Geocoder()
    
    try {
      const poisWithCoords = await Promise.all(data.pois.map(async (poi) => {
        // If already has coords, skip
        if (poi.latitude && poi.longitude) return poi

        let coords = null
        
        // Try name + city (Most accurate for tourist spots)
        if (poi.name && poi.city) {
           coords = await geocodeClientSide(geocoder, `${poi.name}, ${poi.city}`)
        }

        // If failed, try name + address
        if (!coords && poi.name && poi.address) {
           coords = await geocodeClientSide(geocoder, `${poi.name}, ${poi.address}`)
        }

        // If failed, try address only
        if (!coords && poi.address) {
          coords = await geocodeClientSide(geocoder, poi.address)
        }

        // If still failed, try just name
        if (!coords && poi.name) {
          coords = await geocodeClientSide(geocoder, poi.name)
        }

        if (coords) {
          return { ...poi, latitude: coords.lat, longitude: coords.lng }
        }
        
        return poi
      }))

      setPois((prev) => [...prev, ...poisWithCoords])
      toast.success(`${poisWithCoords.length} pontos importados e geocodificados!`)
    } catch (error) {
      console.error("Error during client-side geocoding", error)
      toast.error("Erro ao geocodificar alguns pontos.")
      setPois((prev) => [...prev, ...data.pois])
    } finally {
      setIsGeocoding(false)
    }
  }

  const handleRemovePoi = (index: number) => {
    setPois((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpdatePoi = (index: number, field: keyof POI, value: string) => {
    setPois((prev) => {
      const newPois = [...prev]
      newPois[index] = { ...newPois[index], [field]: value }
      return newPois
    })
  }

  const handleSaveTrip = async () => {
    if (!tripName) {
      toast.error("Por favor, dê um nome para a viagem.")
      return
    }

    if (pois.length === 0) {
      toast.error("Adicione pelo menos um ponto de interesse.")
      return
    }

    try {
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: tripName,
          points: pois,
        }),
      })

      if (!response.ok) {
        throw new Error("Falha ao salvar viagem")
      }

      toast.success("Viagem criada com sucesso!")
      router.push("/trips")
    } catch (error) {
      toast.error("Erro ao salvar viagem.")
      console.error(error)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Nova Viagem</h1>
          <Button onClick={handleSaveTrip}>
            <Save className="mr-2 h-4 w-4" />
            Salvar Viagem
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Detalhes da Viagem</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="tripName">Nome da Viagem</Label>
                  <Input
                    id="tripName"
                    placeholder="Ex: Férias na Europa 2026"
                    value={tripName}
                    onChange={(e) => setTripName(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <DocumentImporter onImport={handleImport} />
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">Pontos de Interesse ({pois.length})</h2>
              {isGeocoding && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            
            {pois.length === 0 ? (
              <div className="text-center p-12 border-2 border-dashed rounded-lg text-muted-foreground">
                Nenhum ponto adicionado. Importe um documento ou adicione manualmente.
              </div>
            ) : (
              <div className="space-y-4">
                {pois.map((poi, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Nome</Label>
                              <Input
                                value={poi.name}
                                onChange={(e) => handleUpdatePoi(index, "name", e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Categoria</Label>
                              <Input
                                value={poi.category}
                                onChange={(e) => handleUpdatePoi(index, "category", e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Endereço</Label>
                            <div className="flex gap-2">
                              <Input
                                value={poi.address}
                                onChange={(e) => handleUpdatePoi(index, "address", e.target.value)}
                              />
                              {poi.latitude && poi.longitude ? (
                                <div className="flex items-center justify-center w-10 h-10 bg-green-100 text-green-600 rounded-md" title="Geocodificado com sucesso">
                                  <MapPin className="h-5 w-5" />
                                </div>
                              ) : (
                                <div className="flex items-center justify-center w-10 h-10 bg-yellow-100 text-yellow-600 rounded-md" title="Localização não encontrada">
                                  <MapPin className="h-5 w-5" />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Descrição</Label>
                            <Textarea
                              value={poi.description}
                              onChange={(e) => handleUpdatePoi(index, "description", e.target.value)}
                            />
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive/90"
                          onClick={() => handleRemovePoi(index)}
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
