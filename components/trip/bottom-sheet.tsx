"use client"

import { useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Snap heights as a fraction of the dynamic viewport height. */
export const SNAPS = [0.16, 0.5, 0.9] as const
export type SnapIndex = 0 | 1 | 2

/**
 * Persistent, non-modal bottom sheet over the full-screen map (mobile). Only the
 * 44px handle drags the sheet, so list scrolling and Stop drag-and-drop never fight
 * with it. Tapping the handle cycles through the snap heights.
 */
export function BottomSheet({
  snap,
  onSnapChange,
  bottomOffset,
  children,
  label,
}: {
  snap: SnapIndex
  onSnapChange: (s: SnapIndex) => void
  /** Space reserved below the sheet (the bottom bar), in px. */
  bottomOffset: number
  children: ReactNode
  label: string
}) {
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const start = useRef<{ y: number; h: number; moved: boolean } | null>(null)

  const vh = () => window.visualViewport?.height ?? window.innerHeight
  const heightFor = (s: SnapIndex) => SNAPS[s] * vh()

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    start.current = { y: e.clientY, h: heightFor(snap), moved: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return
    const dy = start.current.y - e.clientY
    if (Math.abs(dy) > 4) start.current.moved = true
    if (start.current.moved) setDragHeight(Math.min(Math.max(start.current.h + dy, 80), vh() * 0.95))
  }
  const onPointerUp = () => {
    const s = start.current
    start.current = null
    if (!s) return
    if (!s.moved) {
      onSnapChange(((snap + 1) % SNAPS.length) as SnapIndex)
      return
    }
    const h = dragHeight ?? s.h
    setDragHeight(null)
    const nearest = SNAPS.reduce<SnapIndex>(
      (best, frac, i) => (Math.abs(frac * vh() - h) < Math.abs(SNAPS[best] * vh() - h) ? (i as SnapIndex) : best),
      0,
    )
    onSnapChange(nearest)
  }

  return (
    <section
      aria-label={label}
      className={cn(
        "bg-background fixed inset-x-0 z-30 flex flex-col rounded-t-2xl border-t shadow-[0_-8px_24px_rgba(0,0,0,0.12)]",
        dragHeight === null && "transition-[height] duration-200 ease-out",
      )}
      style={{ bottom: bottomOffset, height: dragHeight ?? `${SNAPS[snap] * 100}dvh` }}
    >
      <button
        type="button"
        aria-label={snap === 2 ? "Recolher painel" : "Expandir painel"}
        className="flex h-11 w-full shrink-0 touch-none items-center justify-center"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          start.current = null
          setDragHeight(null)
        }}
      >
        <span className="bg-muted-foreground/40 h-1.5 w-12 rounded-full" />
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </section>
  )
}
