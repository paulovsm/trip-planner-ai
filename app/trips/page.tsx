"use client"

import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, MapPin, Calendar, Trash2 } from "lucide-react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import { api, errorMessage, queryKeys } from "@/lib/client/api"

export default function TripsPage() {
  const { data: trips, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.trips,
    queryFn: api.trips.list,
  })

  const handleDeleteTrip = async (tripId: string, e: React.MouseEvent) => {
    e.preventDefault() // Prevent navigation
    e.stopPropagation()
    
    if (!confirm("Tem certeza que deseja excluir esta viagem? Esta ação não pode ser desfeita.")) return

    try {
      await api.trips.remove(tripId)
      toast.success("Viagem excluída com sucesso!")
      await refetch()
    } catch (error) {
      toast.error(errorMessage(error, "Erro ao excluir viagem."))
    }
  }

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden">
      <Navbar />
      <main className="flex-1 container mx-auto p-8 overflow-y-auto min-h-0">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Minhas Viagens</h1>
          <Link href="/trips/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Viagem
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-32 bg-muted" />
                <CardContent className="h-24" />
              </Card>
            ))}
          </div>
        ) : isError ? (
          <div className="text-center p-12 border-2 border-dashed rounded-lg space-y-4">
            <p className="font-medium">{errorMessage(error, "Não foi possível carregar suas viagens.")}</p>
            <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
          </div>
        ) : trips?.length === 0 ? (
          <div className="text-center p-12 border-2 border-dashed rounded-lg">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-muted rounded-full">
                <MapPin className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <h3 className="text-lg font-medium mb-2">Nenhuma viagem encontrada</h3>
            <p className="text-muted-foreground mb-6">
              Comece criando sua primeira viagem e importando seus roteiros.
            </p>
            <Link href="/trips/new">
              <Button>Criar Viagem</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips?.map((trip) => (
              <Link key={trip.id} href={`/trips/${trip.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full group relative">
                  {trip.role === "owner" && <div className="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity z-10">
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8 shadow-sm"
                      onClick={(e) => handleDeleteTrip(trip.id, e)}
                      aria-label={`Excluir viagem ${trip.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>}
                  <CardHeader>
                    <CardTitle className="truncate pr-8">{trip.name}</CardTitle>
                    <CardDescription>
                      Atualizado em {format(parseISO(trip.updatedAt), "d 'de' MMMM, yyyy", { locale: ptBR })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {trip.placeCount} {trip.placeCount === 1 ? "ponto" : "pontos"}
                      </div>
                      {trip.startDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {format(parseISO(trip.startDate), "dd/MM/yyyy")}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
