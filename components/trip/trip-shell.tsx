"use client"

import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MapsProvider } from "@/components/map/maps-provider"
import { TripMap } from "@/components/map/trip-map"
import { ChatPanel } from "@/components/features/chat/chat-panel"
import { ImportDrawer } from "@/components/import/import-drawer"
import { errorMessage } from "@/lib/client/api"
import { dayPath, defaultDay, mapPins } from "@/lib/client/trip-view"
import { cn } from "@/lib/utils"
import { useIsDesktop } from "@/hooks/use-media-query"
import { useTripDetail } from "@/hooks/use-trip"
import { BOTTOM_BAR_HEIGHT, BottomBar, TABS, type TripTab } from "./bottom-bar"
import { BottomSheet, type SnapIndex } from "./bottom-sheet"
import { DaysPanel } from "./days-panel"
import { MorePanel } from "./more-panel"
import { PlacesPanel } from "./places-panel"
import { SelectedPlaceCard } from "./selected-place-card"
import { TripProvider, type TripContextValue } from "./trip-context"
import { TripHeader } from "./trip-header"

const TAB_IDS = TABS.map((t) => t.id)

/**
 * Trip screen. Mobile: full-screen map + draggable bottom sheet + bottom bar.
 * Desktop: 420px side panel with tabs + map. Tab and Day live in the URL.
 */
export function TripShell({ tripId }: { tripId: string }) {
  const { data: detail, isLoading, error, refetch } = useTripDetail(tripId)
  const isDesktop = useIsDesktop()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [snap, setSnap] = useState<SnapIndex>(1)
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)

  const tab: TripTab = TAB_IDS.includes(params.get("tab") as TripTab) ? (params.get("tab") as TripTab) : "roteiro"
  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString())
      next.set(key, value)
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    },
    [params, pathname, router],
  )

  const selectedDay = useMemo(() => {
    if (!detail) return undefined
    return detail.days.find((d) => d.id === params.get("day")) ?? defaultDay(detail.days)
  }, [detail, params])

  const ctx = useMemo<TripContextValue | null>(() => {
    if (!detail) return null
    return {
      tripId,
      detail,
      placesById: new Map(detail.places.map((p) => [p.id, p])),
      selectedDay,
      selectDay: (dayId) => setParam("day", dayId),
      selectedPlaceId,
      selectPlace: (placeId) => {
        setSelectedPlaceId(placeId)
        if (placeId && !isDesktop) setSnap(0) // reveal the map
      },
      setTab: (t) => setParam("tab", t),
    }
  }, [detail, tripId, selectedDay, setParam, selectedPlaceId, isDesktop])

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <Loader2 className="text-muted-foreground size-8 animate-spin" aria-label="Carregando viagem" />
      </div>
    )
  }
  if (!detail || !ctx) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-medium">{errorMessage(error, "Não foi possível abrir a viagem.")}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            Tentar novamente
          </Button>
          <Button asChild>
            <Link href="/trips">Minhas viagens</Link>
          </Button>
        </div>
      </div>
    )
  }

  const panel = {
    roteiro: <DaysPanel />,
    places: <PlacesPanel />,
    ia: (
      <div className="flex h-full min-h-[60dvh] flex-col">
        <ChatPanel tripId={tripId} />
      </div>
    ),
    mais: <MorePanel extra={<ImportDrawer />} />,
  }[tab]

  const map = (
    <TripMap
      places={mapPins(detail, selectedDay)}
      dayPath={dayPath(detail, selectedDay)}
      routePolyline={selectedDay?.route?.encodedPolyline}
      selectedKey={selectedPlaceId}
      onSelect={ctx.selectPlace}
      fitKey={`${selectedDay?.id ?? "all"}:${detail.places.length}`}
    />
  )

  return (
    <TripProvider value={ctx}>
      <MapsProvider>
        {isDesktop ? (
          <div className="flex h-[100dvh]">
            <aside className="flex w-[420px] shrink-0 flex-col border-r">
              <TripHeader trip={detail.trip} />
              <nav className="flex gap-1 border-b p-2" aria-label="Seções da viagem">
                {TABS.map(({ id, label, icon: Icon }) => (
                  <Button
                    key={id}
                    variant={tab === id ? "secondary" : "ghost"}
                    size="sm"
                    className="flex-1"
                    aria-current={tab === id ? "page" : undefined}
                    onClick={() => ctx.setTab(id)}
                  >
                    <Icon /> {label}
                  </Button>
                ))}
              </nav>
              <div className={cn("min-h-0 flex-1", tab === "ia" ? "flex flex-col" : "overflow-y-auto")}>{panel}</div>
            </aside>
            <main className="relative flex-1">
              {map}
              <SelectedPlaceCard className="absolute top-4 left-4 z-10 w-96" />
            </main>
          </div>
        ) : (
          <div className="fixed inset-0">
            <div className="absolute inset-0">{map}</div>
            <TripHeader trip={detail.trip} floating />
            {snap === 0 && (
              // sits right above the collapsed sheet
              <div className="fixed inset-x-3 z-30" style={{ bottom: `calc(${BOTTOM_BAR_HEIGHT}px + 16dvh + 8px)` }}>
                <SelectedPlaceCard />
              </div>
            )}
            <BottomSheet
              snap={snap}
              onSnapChange={setSnap}
              bottomOffset={BOTTOM_BAR_HEIGHT}
              label={TABS.find((t) => t.id === tab)!.label}
            >
              <div className={cn(tab === "ia" && "h-full")} style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
                {panel}
              </div>
            </BottomSheet>
            <BottomBar
              active={tab}
              onChange={(t) => {
                ctx.setTab(t)
                if (snap === 0) setSnap(1)
              }}
            />
          </div>
        )}
      </MapsProvider>
    </TripProvider>
  )
}
