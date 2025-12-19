"use client"

import { GoogleMap, useJsApiLoader, Marker, InfoWindow, DirectionsRenderer } from "@react-google-maps/api"
import { useState, useCallback, useEffect } from "react"
import { Loader2 } from "lucide-react"

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
}

interface MapProps {
  points: Point[]
  directions?: google.maps.DirectionsResult | null
  transitSegments?: google.maps.DirectionsResult[] | null
  onMapClick?: (e: google.maps.MapMouseEvent) => void
  onMarkerClick?: (point: Point) => void
  isLoaded?: boolean
  activePoint?: Point | null
}

export function Map({ points, directions, transitSegments, onMapClick, onMarkerClick, isLoaded = true, activePoint }: MapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<Point | null>(null)

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
        if (typeof point.latitude === 'number' && typeof point.longitude === 'number') {
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
        if (typeof point.latitude === 'number' && typeof point.longitude === 'number') {
          bounds.extend({ lat: point.latitude, lng: point.longitude })
          hasValidPoints = true
        }
      })
      
      if (hasValidPoints) {
        map.fitBounds(bounds)
      }
    }
  }, [map, points])

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

      {points.map((point) => (
        (typeof point.latitude === 'number' && typeof point.longitude === 'number') ? (
          <Marker
            key={point.id}
            position={{ lat: point.latitude, lng: point.longitude }}
            onClick={() => {
              setSelectedPoint(point)
              onMarkerClick?.(point)
            }}
          />
        ) : null
      ))}

      {selectedPoint && (
        <InfoWindow
          position={{ lat: selectedPoint.latitude, lng: selectedPoint.longitude }}
          onCloseClick={() => setSelectedPoint(null)}
        >
          <div className="p-2 max-w-xs">
            <h3 className="font-bold text-sm">{selectedPoint.name}</h3>
            {selectedPoint.category && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full mt-1 inline-block">
                {selectedPoint.category}
              </span>
            )}
            {selectedPoint.description && (
              <p className="text-xs mt-2 text-muted-foreground line-clamp-3">
                {selectedPoint.description}
              </p>
            )}
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  )
}
