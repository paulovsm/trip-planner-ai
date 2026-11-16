"use client"

import { CalendarPlus, CheckCircle2, Loader2, MapPin, Route, Sparkles, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ProposalView } from "@/lib/domain/proposals"
import { cn } from "@/lib/utils"

const ICONS: Record<ProposalView["kind"], typeof MapPin> = {
  addPlace: MapPin,
  addStop: CalendarPlus,
  removeStop: Trash2,
  markVisited: CheckCircle2,
  planDays: Sparkles,
  optimizeDay: Route,
}

const STATUS: Partial<Record<ProposalView["status"], string>> = {
  applied: "Aplicada",
  discarded: "Descartada",
  failed: "Falhou",
  applying: "Aplicando…",
}

/** A change suggested by the assistant: nothing happens until the user applies it. */
export function ProposalCard({
  proposal,
  busy,
  onDecide,
}: {
  proposal: ProposalView
  busy?: boolean
  onDecide: (decision: "apply" | "discard") => void
}) {
  const Icon = ICONS[proposal.kind]
  const pending = proposal.status === "pending"
  return (
    <div
      className={cn("bg-background rounded-xl border p-3 text-sm", !pending && "opacity-80")}
      role="group"
      aria-label={`Proposta: ${proposal.summary}`}
    >
      <div className="flex items-start gap-2">
        <Icon className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="flex-1">{proposal.summary}</p>
      </div>
      {pending ? (
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={() => onDecide("apply")} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Aplicar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDecide("discard")} disabled={busy}>
            <X /> Descartar
          </Button>
        </div>
      ) : (
        <p className={cn("mt-1 text-xs", proposal.status === "failed" ? "text-destructive" : "text-muted-foreground")}>
          {STATUS[proposal.status]}
          {proposal.error && ` — ${proposal.error}`}
        </p>
      )}
    </div>
  )
}
