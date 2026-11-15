"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"
import { api, queryKeys } from "@/lib/client/api"
import { toLegacyTrip } from "@/lib/client/legacy-view"

export function useTripDetail(tripId: string) {
  return useQuery({ queryKey: queryKeys.trip(tripId), queryFn: () => api.trips.get(tripId), enabled: !!tripId })
}

/** Trip detail adapted to the pre-F2 components (see lib/client/legacy-view.ts). */
export function useLegacyTrip(tripId: string) {
  const query = useTripDetail(tripId)
  const trip = useMemo(() => (query.data ? toLegacyTrip(query.data) : undefined), [query.data])
  return { ...query, trip }
}

/** Invalidates the trip (and list) after a mutation. */
export function useInvalidateTrip(tripId: string) {
  const qc = useQueryClient()
  return useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.trip(tripId) }),
      qc.invalidateQueries({ queryKey: queryKeys.trips }),
    ])
  }, [qc, tripId])
}
