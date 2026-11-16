"use client"

import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Calendar, MapPin, MoreVertical, Plus, Trash2, Users } from "lucide-react"
import { toast } from "sonner"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { api, errorMessage, queryKeys } from "@/lib/client/api"
import { tripDatesLabel } from "@/lib/client/trip-view"
import type { TripSummary } from "@/lib/domain/dto"

function TripCard({ trip, onDelete }: { trip: TripSummary; onDelete: () => void }) {
  return (
    <li className="bg-card relative flex rounded-2xl border transition-shadow hover:shadow-md">
      <Link href={`/trips/${trip.id}`} className="min-w-0 flex-1 p-4">
        <h2 className="truncate text-lg font-semibold">{trip.name}</h2>
        <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
          <Calendar className="size-4" aria-hidden /> {tripDatesLabel(trip.startDate, trip.endDate)}
        </p>
        <p className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden /> {trip.placeCount} {trip.placeCount === 1 ? "lugar" : "lugares"}
          </span>
          {trip.memberCount > 1 && (
            <span className="flex items-center gap-1">
              <Users className="size-3.5" aria-hidden /> {trip.memberCount} pessoas
            </span>
          )}
          {trip.role === "editor" && <span className="bg-secondary rounded-full px-2 py-0.5">Coeditor</span>}
          <span>atualizada {formatDistanceToNow(parseISO(trip.updatedAt), { locale: ptBR, addSuffix: true })}</span>
        </p>
      </Link>
      {trip.role === "owner" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="m-2" aria-label={`Ações para ${trip.name}`}>
              <MoreVertical className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 /> Excluir viagem
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  )
}

export default function TripsPage() {
  const qc = useQueryClient()
  const { data: trips, isLoading, isError, error, refetch } = useQuery({ queryKey: queryKeys.trips, queryFn: api.trips.list })

  const remove = useMutation({
    mutationFn: (tripId: string) => api.trips.remove(tripId),
    onSuccess: () => {
      toast.success("Viagem excluída.")
      qc.invalidateQueries({ queryKey: queryKeys.trips })
    },
    onError: (err) => toast.error(errorMessage(err, "Erro ao excluir a viagem.")),
  })

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <Navbar />
      <main className="container mx-auto w-full max-w-3xl flex-1 px-4 py-6 pb-28">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Minhas viagens</h1>
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/trips/new">
              <Plus /> Nova viagem
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <ul className="space-y-3" aria-busy>
            {[1, 2, 3].map((i) => (
              <li key={i} className="bg-muted h-28 animate-pulse rounded-2xl" />
            ))}
          </ul>
        ) : isError ? (
          <div className="space-y-4 rounded-2xl border-2 border-dashed p-10 text-center">
            <p className="font-medium">{errorMessage(error, "Não foi possível carregar suas viagens.")}</p>
            <Button variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : trips?.length === 0 ? (
          <div className="space-y-4 rounded-2xl border-2 border-dashed p-10 text-center">
            <MapPin className="text-muted-foreground mx-auto size-10" />
            <div>
              <h2 className="font-medium">Nenhuma viagem ainda</h2>
              <p className="text-muted-foreground text-sm">Crie a primeira e importe seus roteiros, reservas ou anotações.</p>
            </div>
            <Button asChild>
              <Link href="/trips/new">Criar viagem</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {trips?.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onDelete={() => {
                  if (confirm(`Excluir "${trip.name}" para todos os participantes? Isso não pode ser desfeito.`)) remove.mutate(trip.id)
                }}
              />
            ))}
          </ul>
        )}
      </main>

      {/* Thumb-reachable primary action on phones */}
      <Button
        asChild
        size="lg"
        className="fixed right-4 z-30 rounded-full shadow-lg sm:hidden"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        <Link href="/trips/new">
          <Plus /> Nova viagem
        </Link>
      </Button>
    </div>
  )
}
