"use client"

import { CalendarDays, MapPin, MoreHorizontal, Sparkles, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type TripTab = "roteiro" | "places" | "ia" | "mais"

export const TABS: { id: TripTab; label: string; icon: LucideIcon }[] = [
  { id: "roteiro", label: "Roteiro", icon: CalendarDays },
  { id: "places", label: "Lugares", icon: MapPin },
  { id: "ia", label: "Assistente", icon: Sparkles },
  { id: "mais", label: "Mais", icon: MoreHorizontal },
]

export const BOTTOM_BAR_HEIGHT = 64

export function BottomBar({ active, onChange }: { active: TripTab; onChange: (t: TripTab) => void }) {
  return (
    <nav
      aria-label="Seções da viagem"
      className="bg-background fixed inset-x-0 bottom-0 z-40 border-t pb-safe md:hidden"
    >
      <ul className="grid grid-cols-4" style={{ height: BOTTOM_BAR_HEIGHT }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => onChange(id)}
              aria-current={active === id ? "page" : undefined}
              className={cn(
                "flex h-full w-full flex-col items-center justify-center gap-1 text-xs font-medium",
                active === id ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
