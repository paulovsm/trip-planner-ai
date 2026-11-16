"use client"

import { useQuery } from "@tanstack/react-query"
import { api, queryKeys } from "@/lib/client/api"

/** Trip detail; refreshes on focus and every 30 s while visible so co-editors see changes (ADR-0002). */
export function useTripDetail(tripId: string) {
  return useQuery({
    queryKey: queryKeys.trip(tripId),
    queryFn: () => api.trips.get(tripId),
    enabled: !!tripId,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })
}
