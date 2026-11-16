"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { LogOut, Monitor, Moon, Settings2, Sun, Trash2 } from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { api, errorMessage, queryKeys } from "@/lib/client/api"
import { useSignOut } from "@/hooks/use-sign-out"
import { cn } from "@/lib/utils"
import { MembersSection } from "./members-section"
import { ShareLinksSection } from "./share-links-section"
import { useTrip } from "./trip-context"
import { TripSettingsDialog } from "./trip-settings-dialog"

const THEMES = [
  { id: "system", label: "Sistema", icon: Monitor },
  { id: "light", label: "Claro", icon: Sun },
  { id: "dark", label: "Escuro", icon: Moon },
] as const

export function MorePanel({ extra }: { extra?: React.ReactNode }) {
  const { tripId, detail } = useTrip()
  const { theme, setTheme } = useTheme()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const router = useRouter()
  const qc = useQueryClient()
  const signOut = useSignOut()
  const isOwner = detail.role === "owner"

  const remove = useMutation({
    mutationFn: () => api.trips.remove(tripId),
    onSuccess: () => {
      qc.removeQueries({ queryKey: queryKeys.trip(tripId) })
      qc.invalidateQueries({ queryKey: queryKeys.trips })
      toast.success("Viagem excluída.")
      router.replace("/trips")
    },
    onError: (err) => toast.error(errorMessage(err, "Erro ao excluir a viagem.")),
  })

  return (
    <div className="space-y-8 p-4">
      <section className="space-y-2">
        <h2 className="font-semibold">Viagem</h2>
        <Button variant="outline" className="w-full justify-start" onClick={() => setSettingsOpen(true)}>
          <Settings2 /> Nome e datas
        </Button>
        {extra}
      </section>

      <MembersSection />
      {isOwner && <ShareLinksSection />}

      <section className="space-y-2">
        <h2 className="font-semibold">Aparência</h2>
        <div role="radiogroup" aria-label="Tema" className="bg-muted grid grid-cols-3 gap-1 rounded-xl p-1">
          {THEMES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={theme === id}
              onClick={() => setTheme(id)}
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm",
                theme === id ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Conta</h2>
        <Button variant="outline" className="w-full justify-start" onClick={signOut}>
          <LogOut /> Sair
        </Button>
        {isOwner && (
          <Button
            variant="ghost"
            className="text-destructive w-full justify-start"
            disabled={remove.isPending}
            onClick={() => {
              if (confirm(`Excluir "${detail.trip.name}" para todos os participantes? Isso não pode ser desfeito.`)) remove.mutate()
            }}
          >
            <Trash2 /> Excluir viagem
          </Button>
        )}
      </section>

      {settingsOpen && <TripSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />}
    </div>
  )
}
