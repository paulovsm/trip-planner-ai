"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AdvancedMarker,
  APILoadingStatus,
  ColorScheme,
  ControlPosition,
  Map,
  MapControl,
  Polyline,
  useApiLoadingStatus,
  useMap,
} from "@vis.gl/react-google-maps"
import { Check, Crosshair, Loader2, MapPinOff } from "lucide-react"
import { toast } from "sonner"
import { getCategoryConfig } from "@/lib/constants"
import type { PlaceCategory } from "@/lib/domain/categories"
import { VISITED_COLOR } from "@/lib/domain/category-colors"
import { cn } from "@/lib/utils"
import { MAP_ID, MAPS_API_KEY } from "./maps-provider"

export type MapPlace = {
  key: string
  name: string
  category: PlaceCategory
  lat: number
  lng: number
  visited: boolean
  /** 1-based position in the selected Day, when it is part of it. */
  order?: number
}

type Props = {
  places: MapPlace[]
  /** Encoded polyline of the selected Day's Route; falls back to straight segments. */
  routePolyline?: string | null
  /** Ordered path of the selected Day (used when there is no stored Route). */
  dayPath?: { lat: number; lng: number }[]
  selectedKey?: string | null
  onSelect?: (key: string | null) => void
  /** Changes whenever the camera should re-fit (e.g. selected day). */
  fitKey?: string
  className?: string
}

const DEFAULT_CENTER = { lat: -15.78, lng: -47.93 } // Brasília, when nothing is known yet

function FitBounds({ points, fitKey }: { points: { lat: number; lng: number }[]; fitKey: string }) {
  const map = useMap()
  useEffect(() => {
    if (!map || points.length === 0) return
    if (points.length === 1) {
      map.setCenter(points[0])
      map.setZoom(15)
      return
    }
    const bounds = new google.maps.LatLngBounds()
    points.forEach((p) => bounds.extend(p))
    map.fitBounds(bounds, 56)
    // Only refit when the set of points (or the explicit key) changes — not on every refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey])
  return null
}

function PanTo({ target }: { target?: { lat: number; lng: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (map && target) map.panTo(target)
  }, [map, target])
  return null
}

function LocateMe() {
  const map = useMap()
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)

  const locate = () => {
    if (!navigator.geolocation) {
      toast.error("Seu navegador não suporta geolocalização.")
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const pos = { lat: coords.latitude, lng: coords.longitude }
        setPosition(pos)
        map?.panTo(pos)
        map?.setZoom(16)
        setLocating(false)
      },
      () => {
        toast.error("Não foi possível obter sua localização.")
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  return (
    <>
      <MapControl position={ControlPosition.RIGHT_BOTTOM}>
        <button
          type="button"
          onClick={locate}
          aria-label="Mostrar minha localização"
          className="bg-background text-foreground m-3 flex size-11 items-center justify-center rounded-full border shadow-md"
        >
          {locating ? <Loader2 className="size-5 animate-spin" /> : <Crosshair className="size-5" />}
        </button>
      </MapControl>
      {position && (
        <AdvancedMarker position={position} title="Você está aqui" zIndex={1000}>
          <span className="block size-4 rounded-full border-2 border-white bg-blue-600 shadow ring-4 ring-blue-600/25" />
        </AdvancedMarker>
      )}
    </>
  )
}

function Pin({ place, selected }: { place: MapPlace; selected: boolean }) {
  const { color, icon: Icon } = getCategoryConfig(place.category)
  return (
    // 44px hit area around a 32px pin
    <span className="flex size-11 items-center justify-center">
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-md transition-transform",
          selected && "scale-125 ring-4 ring-black/20",
        )}
        style={{ backgroundColor: place.visited ? VISITED_COLOR : color }}
      >
        {place.visited ? <Check className="size-4" /> : place.order ? place.order : <Icon className="size-4" />}
      </span>
    </span>
  )
}

export function TripMap({ places, routePolyline, dayPath, selectedKey, onSelect, fitKey, className }: Props) {
  const status = useApiLoadingStatus()
  const fitPoints = useMemo(
    () => (dayPath && dayPath.length ? dayPath : places.map((p) => ({ lat: p.lat, lng: p.lng }))),
    [dayPath, places],
  )
  const computedFitKey = fitKey ?? fitPoints.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|")
  const selected = places.find((p) => p.key === selectedKey)

  if (!MAPS_API_KEY || status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className={cn("bg-muted text-muted-foreground flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center text-sm", className)}>
        <MapPinOff className="size-6" />
        {MAPS_API_KEY ? "Não foi possível carregar o Google Maps." : "Mapa indisponível: chave do Google Maps não configurada."}
      </div>
    )
  }

  return (
    <div className={cn("relative h-full w-full", className)}>
      {status !== APILoadingStatus.LOADED && (
        <div className="bg-muted absolute inset-0 z-10 flex items-center justify-center">
          <Loader2 className="text-muted-foreground size-6 animate-spin" aria-label="Carregando mapa" />
        </div>
      )}
      <Map
        mapId={MAP_ID}
        colorScheme={ColorScheme.FOLLOW_SYSTEM}
        defaultCenter={fitPoints[0] ?? DEFAULT_CENTER}
        defaultZoom={fitPoints.length ? 13 : 4}
        gestureHandling="greedy"
        disableDefaultUI
        clickableIcons={false}
        onClick={() => onSelect?.(null)}
        className="h-full w-full"
      >
        <FitBounds points={fitPoints} fitKey={computedFitKey} />
        <PanTo target={selected ? { lat: selected.lat, lng: selected.lng } : null} />
        {routePolyline ? (
          <Polyline encodedPath={routePolyline} strokeColor="#0e7490" strokeOpacity={0.9} strokeWeight={5} />
        ) : dayPath && dayPath.length > 1 ? (
          <Polyline path={dayPath} strokeColor="#0e7490" strokeOpacity={0.6} strokeWeight={3} geodesic />
        ) : null}
        {places.map((p) => (
          <AdvancedMarker
            key={p.key}
            position={{ lat: p.lat, lng: p.lng }}
            title={p.name}
            zIndex={p.key === selectedKey ? 999 : p.order ? 500 - p.order : 1}
            onClick={() => onSelect?.(p.key)}
          >
            <Pin place={p} selected={p.key === selectedKey} />
          </AdvancedMarker>
        ))}
        <LocateMe />
      </Map>
    </div>
  )
}
