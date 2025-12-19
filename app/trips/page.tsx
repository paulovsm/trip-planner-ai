"use client"

import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, MapPin, Calendar } from "lucide-react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface Trip {
  id: string
  name: string
  description: string | null
  startDate: string | null
  endDate: string | null
  updatedAt: string
  _count: {
    points: number
  }
}

export default function TripsPage() {
  const { data: trips, isLoading } = useQuery<Trip[]>({
    queryKey: ["trips"],
    queryFn: async () => {
      const res = await fetch("/api/trips")
      if (!res.ok) throw new Error("Failed to fetch trips")
      return res.json()
    },
  })

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto p-8">
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
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardHeader>
                    <CardTitle className="truncate">{trip.name}</CardTitle>
                    <CardDescription>
                      Atualizado em {format(new Date(trip.updatedAt), "d 'de' MMMM, yyyy", { locale: ptBR })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {trip._count.points} pontos
                      </div>
                      {trip.startDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(trip.startDate), "dd/MM/yyyy")}
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
