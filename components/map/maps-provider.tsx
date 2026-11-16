"use client"

import type { ReactNode } from "react"
import { APIProvider } from "@vis.gl/react-google-maps"

export const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""
/** Cloud map style id (needed for Advanced Markers and dark mode). DEMO_MAP_ID works for development. */
export const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID"

/** Loads the Maps JS API once for the subtree. Without a key, children render and maps show a placeholder. */
export function MapsProvider({ children }: { children: ReactNode }) {
  if (!MAPS_API_KEY) return <>{children}</>
  return (
    <APIProvider apiKey={MAPS_API_KEY} language="pt-BR">
      {children}
    </APIProvider>
  )
}
