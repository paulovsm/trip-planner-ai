"use client"

import { GoogleMap, useJsApiLoader, Marker, InfoWindow, DirectionsRenderer, OverlayView } from "@react-google-maps/api"
import { useState, useCallback, useEffect } from "react"
import { Loader2, AlertTriangle, ExternalLink, Crosshair, CheckCircle2 } from "lucide-react"
import { getCategoryConfig } from "@/lib/constants"
import { cn } from "@/lib/utils"

const containerStyle = {
  width: "100%",
  height: "100%",
  borderRadius: "0.5rem",
}

const defaultCenter = {
  lat: 48.8566, // Paris
  lng: 2.3522,
}

interface Point {
  id: string
  name: string
  latitude: number
  longitude: number
  category?: string | null
  description?: string | null
  visited?: boolean
}

interface MapProps {
  points: Point[]
  directions?: google.maps.DirectionsResult | null
  transitSegments?: google.maps.DirectionsResult[] | null
  onMapClick?: (e: google.maps.MapMouseEvent) => void
  onMarkerClick?: (point: Point) => void
  isLoaded?: boolean
  loadError?: Error | undefined
  activePoint?: Point | null
}

export function Map({ points, directions, transitSegments, onMapClick, onMarkerClick, isLoaded = true, loadError, activePoint }: MapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<Point | null>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [isLocating, setIsLocating] = useState(false)

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert("Geolocalização não é suportada pelo seu navegador.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(pos);
        map?.panTo(pos);
        map?.setZoom(15);
        setIsLocating(false);
      },
      () => {
        alert("Erro ao obter sua localização.");
        setIsLocating(false);
      }
    );
  };

  // Update internal selected point when activePoint prop changes
  useEffect(() => {
    if (activePoint) {
      setSelectedPoint(activePoint)
      if (map && activePoint.latitude && activePoint.longitude) {
        map.panTo({ lat: activePoint.latitude, lng: activePoint.longitude })
        map.setZoom(15)
      }
    }
  }, [activePoint, map])

  const onLoad = useCallback((map: google.maps.Map) => {
    const bounds = new google.maps.LatLngBounds()
    let hasValidPoints = false
    
    if (points.length > 0) {
      points.forEach((point) => {
        // Check for valid coordinates (including 0)
        if (point && typeof point.latitude === 'number' && typeof point.longitude === 'number') {
          bounds.extend({ lat: point.latitude, lng: point.longitude })
          hasValidPoints = true
        }
      })
      
      if (hasValidPoints) {
        map.fitBounds(bounds)
      } else {
        map.setCenter(defaultCenter)
        map.setZoom(12)
      }
    } else {
      map.setCenter(defaultCenter)
      map.setZoom(12)
    }

    setMap(map)
  }, [points])

  const onUnmount = useCallback(() => {
    setMap(null)
  }, [])

  useEffect(() => {
    if (map && points.length > 0) {
      const bounds = new google.maps.LatLngBounds()
      let hasValidPoints = false
      
      points.forEach((point) => {
        if (point && typeof point.latitude === 'number' && typeof point.longitude === 'number') {
          bounds.extend({ lat: point.latitude, lng: point.longitude })
          hasValidPoints = true
        }
      })
      
      if (hasValidPoints) {
        map.fitBounds(bounds)
      }
    }
  }, [map, points])

  if (loadError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-muted rounded-lg p-4 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-sm font-medium text-destructive">Erro ao carregar o mapa</p>
        <p className="text-xs text-muted-foreground mt-1">{loadError.message}</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted rounded-lg">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={defaultCenter}
      zoom={10}
      onLoad={onLoad}
      onUnmount={onUnmount}
      onClick={onMapClick}
      options={{
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      }}
    >
      {directions && (
        <DirectionsRenderer
          directions={directions}
          options={{
            suppressMarkers: true, // We use our own markers
            polylineOptions: {
              strokeColor: "#2563eb",
              strokeWeight: 5,
            },
          }}
        />
      )}

      {transitSegments && transitSegments.map((segment, index) => (
        <DirectionsRenderer
          key={index}
          directions={segment}
          options={{
            suppressMarkers: true, // We use our own markers
            polylineOptions: {
              strokeColor: "#2563eb",
              strokeWeight: 5,
            },
          }}
        />
      ))}

      {points.map((point) => {
        if (!point) return null;
        if (typeof point.latitude !== 'number' || typeof point.longitude !== 'number') return null;
        
        const categoryConfig = getCategoryConfig(point.category || undefined);
        const IconComponent = categoryConfig.icon;
        const isVisited = point.visited || false;
        const markerColor = isVisited ? '#9ca3af' : categoryConfig.color;
        
        return (
          <OverlayView
            key={point.id}
            position={{ lat: point.latitude, lng: point.longitude }}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
          >
            <div
              className={cn(
                "relative flex flex-col items-center cursor-pointer transform -translate-x-1/2 -translate-y-full hover:scale-110 transition-transform z-10 hover:z-20 group",
                isVisited && "opacity-80"
              )}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPoint(point);
                onMarkerClick?.(point);
              }}
            >
              <div 
                className="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center transition-transform"
                style={{ backgroundColor: markerColor }}
              >
                {isVisited ? (
                   <CheckCircle2 className="w-4 h-4 text-white" />
                ) : (
                   <IconComponent className="w-4 h-4 text-white" />
                )}
              </div>
              <div 
                className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] -mt-0.5"
                style={{ borderTopColor: markerColor }}
              />
            </div>
          </OverlayView>
        )
      })}

      {selectedPoint && (
        <InfoWindow
          position={{ lat: selectedPoint.latitude, lng: selectedPoint.longitude }}
          onCloseClick={() => setSelectedPoint(null)}
        >
          <div className="p-2 max-w-xs">
            <h3 className="font-bold text-sm">{selectedPoint.name}</h3>
            {selectedPoint.category && (
              <span 
                className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block text-white"
                style={{ backgroundColor: getCategoryConfig(selectedPoint.category).color }}
              >
                {selectedPoint.category}
              </span>
            )}
            {selectedPoint.description && (
              <p className="text-xs mt-2 text-muted-foreground line-clamp-3">
                {selectedPoint.description}
              </p>
            )}
            <a 
              href={`https://www.google.com/maps/search/?api=1&query=${selectedPoint.latitude},${selectedPoint.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-2"
            >
              <ExternalLink className="h-3 w-3" />
              Abrir no Maps
            </a>
          </div>
        </InfoWindow>
      )}

      {userLocation && (
        <Marker
          position={userLocation}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: "#4285F4",
            fillOpacity: 1,
            strokeColor: "white",
            strokeWeight: 2,
          }}
          title="Sua localização"
        />
      )}

      <button
        className="absolute bottom-24 right-4 bg-white p-2 md:p-3 rounded-full shadow-md hover:bg-gray-100 focus:outline-none z-10"
        onClick={handleLocateMe}
        title="Minha localização"
      >
        {isLocating ? (
          <Loader2 className="h-5 w-5 md:h-6 md:w-6 animate-spin text-primary" />
        ) : (
          <Crosshair className="h-5 w-5 md:h-6 md:w-6 text-gray-700" />
        )}
      </button>
    </GoogleMap>
  )
}
