"use client"

import { createContext, useContext } from "react"
import type { TripDetail } from "@/lib/domain/dto"
import type { Day, Place } from "@/lib/domain/schemas"
import type { TripTab } from "./bottom-bar"

export type TripContextValue = {
  tripId: string
  detail: TripDetail
  placesById: Map<string, Place>
  selectedDay: Day | undefined
  selectDay: (dayId: string) => void
  selectedPlaceId: string | null
  /** Selects a Place on the map (and brings the map into view on mobile). */
  selectPlace: (placeId: string | null) => void
  setTab: (tab: TripTab) => void
}

const TripContext = createContext<TripContextValue | null>(null)
export const TripProvider = TripContext.Provider

export function useTrip(): TripContextValue {
  const ctx = useContext(TripContext)
  if (!ctx) throw new Error("useTrip must be used inside <TripProvider>")
  return ctx
}
