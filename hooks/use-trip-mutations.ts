"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ApiError, api, errorMessage, queryKeys } from "@/lib/client/api"
import type { TripDetail } from "@/lib/domain/dto"
import type {
  CreateDayInput,
  CreatePlaceInput,
  Day,
  Stop,
  TravelMode,
  UpdatePlaceInput,
  UpdateStopInput,
} from "@/lib/domain/schemas"
import { applyOrder, insertStop, moveStop, removePlace, removeStop, updateStop } from "@/lib/domain/stops"

// Optimistic mutations on the cached TripDetail. Local transforms reuse the same pure
// domain operations the server applies, so the UI and the server agree on results.

type Ctx = { previous?: TripDetail }

export const VISITED_MUTATION_KEY = ["place-visited"] as const
export type VisitedVars = { tripId: string; placeId: string; visited: boolean }

function useTripCache(tripId: string) {
  const qc = useQueryClient()
  const key = queryKeys.trip(tripId)
  return {
    qc,
    key,
    async snapshot(): Promise<Ctx> {
      await qc.cancelQueries({ queryKey: key })
      return { previous: qc.getQueryData<TripDetail>(key) }
    },
    patch(fn: (d: TripDetail) => TripDetail) {
      qc.setQueryData<TripDetail>(key, (d) => (d ? fn(d) : d))
    },
    rollback(ctx?: Ctx) {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous)
    },
    replaceDays(days: Day[]) {
      qc.setQueryData<TripDetail>(key, (d) =>
        d ? { ...d, days: d.days.map((x) => days.find((n) => n.id === x.id) ?? x) } : d,
      )
    },
    invalidate() {
      return Promise.all([qc.invalidateQueries({ queryKey: key }), qc.invalidateQueries({ queryKey: queryKeys.trips })])
    },
  }
}

function reportError(err: unknown, fallback: string) {
  if (err instanceof ApiError && err.status === 409) {
    toast.warning("Alguém editou este dia ao mesmo tempo. A lista foi atualizada.")
  } else {
    toast.error(errorMessage(err, fallback))
  }
}

const mapDay = (d: TripDetail, dayId: string, fn: (day: Day) => Day): TripDetail => ({
  ...d,
  days: d.days.map((day) => (day.id === dayId ? fn(day) : day)),
})
const withStops = (day: Day, stops: Stop[]): Day => ({ ...day, stops, version: day.version + 1 })

// ---------- Places ----------

/** Offline-capable: absolute and idempotent, its mutationFn is registered as a default (providers). */
export function useSetVisited(tripId: string) {
  const cache = useTripCache(tripId)
  return useMutation<unknown, unknown, VisitedVars, Ctx>({
    mutationKey: VISITED_MUTATION_KEY,
    onMutate: async ({ placeId, visited }) => {
      const ctx = await cache.snapshot()
      cache.patch((d) => ({ ...d, places: d.places.map((p) => (p.id === placeId ? { ...p, visited } : p)) }))
      return ctx
    },
    onError: (err, _v, ctx) => {
      cache.rollback(ctx)
      reportError(err, "Erro ao marcar como visitado.")
    },
    onSettled: () => cache.invalidate(),
  })
}

export function useCreatePlace(tripId: string) {
  const cache = useTripCache(tripId)
  return useMutation({
    mutationFn: (input: CreatePlaceInput) => api.places.create(tripId, input),
    onSuccess: (place) => cache.patch((d) => ({ ...d, places: [...d.places, place] })),
    onError: (err) => reportError(err, "Erro ao adicionar o lugar."),
    onSettled: () => cache.invalidate(),
  })
}

export function useUpdatePlace(tripId: string) {
  const cache = useTripCache(tripId)
  return useMutation<unknown, unknown, { placeId: string; input: UpdatePlaceInput }, Ctx>({
    mutationFn: ({ placeId, input }) => api.places.update(tripId, placeId, input),
    onMutate: async ({ placeId, input }) => {
      const ctx = await cache.snapshot()
      cache.patch((d) => ({ ...d, places: d.places.map((p) => (p.id === placeId ? { ...p, ...input } : p)) }))
      return ctx
    },
    onError: (err, _v, ctx) => {
      cache.rollback(ctx)
      reportError(err, "Erro ao salvar o lugar.")
    },
    onSettled: () => cache.invalidate(),
  })
}

export function useDeletePlace(tripId: string) {
  const cache = useTripCache(tripId)
  return useMutation<unknown, unknown, string, Ctx>({
    mutationFn: (placeId) => api.places.remove(tripId, placeId),
    onMutate: async (placeId) => {
      const ctx = await cache.snapshot()
      cache.patch((d) => ({
        ...d,
        places: d.places.filter((p) => p.id !== placeId),
        days: d.days.map((day) => ({ ...day, stops: removePlace(day.stops, placeId) })),
      }))
      return ctx
    },
    onError: (err, _v, ctx) => {
      cache.rollback(ctx)
      reportError(err, "Erro ao remover o lugar.")
    },
    onSettled: () => cache.invalidate(),
  })
}

// ---------- Days ----------

export function useCreateDay(tripId: string) {
  const cache = useTripCache(tripId)
  return useMutation({
    mutationFn: (input: CreateDayInput) => api.days.create(tripId, input),
    onSuccess: (day) =>
      cache.patch((d) => ({ ...d, days: [...d.days, day].sort((a, b) => a.date.localeCompare(b.date)) })),
    onError: (err) => reportError(err, "Erro ao adicionar o dia."),
    onSettled: () => cache.invalidate(),
  })
}

export function useUpdateDay(tripId: string) {
  const cache = useTripCache(tripId)
  return useMutation<Day, unknown, { dayId: string; date?: string; travelMode?: TravelMode }, Ctx>({
    mutationFn: ({ dayId, ...input }) => api.days.update(tripId, dayId, input),
    onMutate: async ({ dayId, ...input }) => {
      const ctx = await cache.snapshot()
      cache.patch((d) => mapDay(d, dayId, (day) => ({ ...day, ...input })))
      return ctx
    },
    onSuccess: (day) => cache.replaceDays([day]),
    onError: (err, _v, ctx) => {
      cache.rollback(ctx)
      reportError(err, "Erro ao atualizar o dia.")
    },
    onSettled: () => cache.invalidate(),
  })
}

export function useDeleteDay(tripId: string) {
  const cache = useTripCache(tripId)
  return useMutation<unknown, unknown, string, Ctx>({
    mutationFn: (dayId) => api.days.remove(tripId, dayId),
    onMutate: async (dayId) => {
      const ctx = await cache.snapshot()
      cache.patch((d) => ({ ...d, days: d.days.filter((day) => day.id !== dayId) }))
      return ctx
    },
    onError: (err, _v, ctx) => {
      cache.rollback(ctx)
      reportError(err, "Erro ao excluir o dia.")
    },
    onSettled: () => cache.invalidate(),
  })
}

// ---------- Stops ----------

export function useAddStop(tripId: string) {
  const cache = useTripCache(tripId)
  return useMutation<Day, unknown, { dayId: string; placeId: string; index?: number }, Ctx>({
    mutationFn: ({ dayId, ...input }) => api.days.addStop(tripId, dayId, input),
    onMutate: async ({ dayId, placeId, index }) => {
      const ctx = await cache.snapshot()
      cache.patch((d) =>
        mapDay(d, dayId, (day) => withStops(day, insertStop(day.stops, { id: `tmp-${Date.now()}`, placeId }, index))),
      )
      return ctx
    },
    onSuccess: (day) => cache.replaceDays([day]),
    onError: (err, _v, ctx) => {
      cache.rollback(ctx)
      reportError(err, "Erro ao adicionar a parada.")
    },
    onSettled: () => cache.invalidate(),
  })
}

export type EditStopVars = { dayId: string; stopId: string } & UpdateStopInput

/** Details (time/duration/notes) and moves (toIndex within the Day, toDayId across Days). */
export function useEditStop(tripId: string) {
  const cache = useTripCache(tripId)
  return useMutation<Day[], unknown, EditStopVars, Ctx>({
    mutationFn: ({ dayId, stopId, ...input }) => api.days.updateStop(tripId, dayId, stopId, input),
    onMutate: async ({ dayId, stopId, toIndex, toDayId, ...details }) => {
      const ctx = await cache.snapshot()
      cache.patch((d) => {
        const from = d.days.find((x) => x.id === dayId)
        if (!from) return d
        let stops = updateStop(from.stops, stopId, details)
        if (!toDayId || toDayId === dayId) {
          if (toIndex !== undefined) stops = moveStop(stops, stopId, toIndex)
          return mapDay(d, dayId, (day) => withStops(day, stops))
        }
        const stop = stops.find((s) => s.id === stopId)!
        return mapDay(
          mapDay(d, dayId, (day) => withStops(day, removeStop(stops, stopId))),
          toDayId,
          (day) => withStops(day, insertStop(day.stops, stop, toIndex)),
        )
      })
      return ctx
    },
    onSuccess: (days) => cache.replaceDays(days),
    onError: (err, _v, ctx) => {
      cache.rollback(ctx)
      reportError(err, "Erro ao atualizar a parada.")
    },
    onSettled: () => cache.invalidate(),
  })
}

export function useRemoveStop(tripId: string) {
  const cache = useTripCache(tripId)
  return useMutation<Day, unknown, { dayId: string; stopId: string }, Ctx>({
    mutationFn: ({ dayId, stopId }) => api.days.removeStop(tripId, dayId, stopId),
    onMutate: async ({ dayId, stopId }) => {
      const ctx = await cache.snapshot()
      cache.patch((d) => mapDay(d, dayId, (day) => withStops(day, removeStop(day.stops, stopId))))
      return ctx
    },
    onSuccess: (day) => cache.replaceDays([day]),
    onError: (err, _v, ctx) => {
      cache.rollback(ctx)
      reportError(err, "Erro ao remover a parada.")
    },
    onSettled: () => cache.invalidate(),
  })
}

/** Whole-order replacement (Optimize / Undo); 409 if the Day changed meanwhile. */
export function useReorderStops(tripId: string) {
  const cache = useTripCache(tripId)
  return useMutation<Day, unknown, { dayId: string; stopIds: string[]; expectedVersion: number }, Ctx>({
    mutationFn: ({ dayId, stopIds, expectedVersion }) => api.days.reorder(tripId, dayId, stopIds, expectedVersion),
    onMutate: async ({ dayId, stopIds }) => {
      const ctx = await cache.snapshot()
      cache.patch((d) => mapDay(d, dayId, (day) => withStops(day, applyOrder(day.stops, stopIds))))
      return ctx
    },
    onSuccess: (day) => cache.replaceDays([day]),
    onError: (err, _v, ctx) => {
      cache.rollback(ctx)
      reportError(err, "Erro ao reordenar o dia.")
    },
    onSettled: () => cache.invalidate(),
  })
}
