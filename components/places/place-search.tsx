"use client"

import { useEffect, useRef, useState } from "react"
import { useMapsLibrary } from "@vis.gl/react-google-maps"
import { Loader2, MapPin } from "lucide-react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import type { PlaceCategory } from "@/lib/domain/categories"
import { categoryFromGoogleTypes, cityFromAddressComponents } from "@/lib/domain/google-types"
import { MAPS_API_KEY } from "@/components/map/maps-provider"

export type PickedPlace = {
  name: string
  address?: string
  city?: string
  category: PlaceCategory
  location: { lat: number; lng: number }
  googlePlaceId: string
}

type Suggestion = { id: string; main: string; secondary: string; prediction: google.maps.places.PlacePrediction }

/**
 * Places Autocomplete (New) with session tokens (one billing session per pick).
 * `bias` nudges results toward the trip's area.
 */
export function PlaceSearch({
  onPick,
  bias,
  autoFocus,
  placeholder = "Buscar um lugar (ex.: Torre de Belém)",
}: {
  onPick: (place: PickedPlace) => void
  bias?: { lat: number; lng: number }
  autoFocus?: boolean
  placeholder?: string
}) {
  const places = useMapsLibrary("places")
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const token = useRef<google.maps.places.AutocompleteSessionToken | null>(null)

  useEffect(() => {
    if (!places || query.trim().length < 2) return
    let cancelled = false
    const handle = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        token.current ??= new places.AutocompleteSessionToken()
        const { suggestions: raw } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          sessionToken: token.current,
          language: "pt-BR",
          ...(bias ? { locationBias: { center: bias, radius: 50_000 } } : {}),
        })
        if (cancelled) return
        setSuggestions(
          raw.flatMap((s) =>
            s.placePrediction
              ? [
                  {
                    id: s.placePrediction.placeId,
                    main: s.placePrediction.mainText?.text ?? s.placePrediction.text.text,
                    secondary: s.placePrediction.secondaryText?.text ?? "",
                    prediction: s.placePrediction,
                  },
                ]
              : [],
          ),
        )
      } catch {
        if (!cancelled) setError("Não foi possível buscar lugares agora.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [places, query, bias])

  const pick = async (s: Suggestion) => {
    setLoading(true)
    try {
      const place = s.prediction.toPlace()
      await place.fetchFields({ fields: ["displayName", "formattedAddress", "location", "types", "addressComponents"] })
      token.current = null // the session ends with fetchFields
      if (!place.location) throw new Error("no location")
      onPick({
        name: place.displayName ?? s.main,
        address: place.formattedAddress ?? undefined,
        city: cityFromAddressComponents(place.addressComponents),
        category: categoryFromGoogleTypes(place.types),
        location: { lat: place.location.lat(), lng: place.location.lng() },
        googlePlaceId: place.id,
      })
      setQuery("")
      setSuggestions([])
    } catch {
      setError("Não foi possível carregar os detalhes deste lugar.")
    } finally {
      setLoading(false)
    }
  }

  if (!MAPS_API_KEY) {
    return <p className="text-muted-foreground text-sm">Busca indisponível: chave do Google Maps não configurada.</p>
  }

  const visible = query.trim().length >= 2 ? suggestions : []

  return (
    <Command shouldFilter={false} className="border">
      <CommandInput value={query} onValueChange={setQuery} placeholder={placeholder} autoFocus={autoFocus} />
      <CommandList>
        {loading && (
          <div className="text-muted-foreground flex items-center gap-2 p-3 text-sm">
            <Loader2 className="size-4 animate-spin" /> Buscando…
          </div>
        )}
        {error && <p className="text-destructive p-3 text-sm">{error}</p>}
        {!loading && query.trim().length >= 2 && <CommandEmpty>Nenhum lugar encontrado.</CommandEmpty>}
        {visible.length > 0 && (
          <CommandGroup heading="Sugestões do Google">
            {visible.map((s) => (
              <CommandItem key={s.id} value={s.id} onSelect={() => pick(s)}>
                <MapPin className="text-muted-foreground size-4 shrink-0" />
                <div className="min-w-0">
                  <div className="truncate font-medium">{s.main}</div>
                  {s.secondary && <div className="text-muted-foreground truncate text-xs">{s.secondary}</div>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  )
}
