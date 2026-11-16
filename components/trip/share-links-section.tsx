"use client"

import { useId, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Check, Copy, Link2, Loader2, Share2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, errorMessage, queryKeys } from "@/lib/client/api"
import { useTrip } from "./trip-context"

const EXPIRY_OPTIONS = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
  { days: 365, label: "1 ano" },
]
const STATUS_LABEL = { active: "Ativo", expired: "Expirado", revoked: "Revogado" } as const

/** Owner only: read-only public links (token shown once, ADR-0006). */
export function ShareLinksSection() {
  const { tripId, detail } = useTrip()
  const qc = useQueryClient()
  const id = useId()
  const [expiresInDays, setExpiresInDays] = useState(30)
  const [url, setUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const links = useQuery({ queryKey: queryKeys.shareLinks(tripId), queryFn: () => api.shareLinks.list(tripId) })
  const refresh = () => qc.invalidateQueries({ queryKey: queryKeys.shareLinks(tripId) })

  const create = useMutation({
    mutationFn: () => api.shareLinks.create(tripId, expiresInDays),
    onSuccess: (link) => {
      setUrl(`${window.location.origin}${link.path}`)
      refresh()
    },
    onError: (err) => toast.error(errorMessage(err, "Erro ao gerar o link.")),
  })
  const revoke = useMutation({
    mutationFn: (linkId: string) => api.shareLinks.revoke(tripId, linkId),
    onSuccess: () => {
      toast.success("Link revogado.")
      refresh()
    },
    onError: (err) => toast.error(errorMessage(err, "Erro ao revogar o link.")),
  })

  const copy = async () => {
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  const share = async () => {
    if (!url) return
    try {
      await navigator.share({ title: detail.trip.name, text: `Roteiro: ${detail.trip.name}`, url })
    } catch {
      // user cancelled
    }
  }
  const canShare = typeof navigator !== "undefined" && "share" in navigator

  return (
    <section className="space-y-3" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="font-semibold">
        Link público
      </h2>
      <p className="text-muted-foreground text-xs">
        Somente leitura, sem notas e sem mostrar quem você é. O link aparece uma única vez: copie ou compartilhe agora.
      </p>
      {url ? (
        <div className="space-y-2">
          <Label htmlFor={`${id}-url`} className="sr-only">
            Link
          </Label>
          <Input id={`${id}-url`} value={url} readOnly onFocus={(e) => e.currentTarget.select()} />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={copy}>
              {copied ? <Check /> : <Copy />} Copiar
            </Button>
            {canShare && (
              <Button onClick={share}>
                <Share2 /> Compartilhar
              </Button>
            )}
          </div>
          <Button variant="ghost" className="w-full" onClick={() => setUrl(null)}>
            Concluir
          </Button>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor={`${id}-exp`}>Validade</Label>
            <select
              id={`${id}-exp`}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              className="border-input bg-transparent dark:bg-input/30 h-9 w-full rounded-md border px-3 text-sm pointer-coarse:h-11"
            >
              {EXPIRY_OPTIONS.map((o) => (
                <option key={o.days} value={o.days}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? <Loader2 className="animate-spin" /> : <Link2 />} Gerar link
          </Button>
        </div>
      )}
      {(links.data?.length ?? 0) > 0 && (
        <ul className="divide-y rounded-xl border text-sm">
          {links.data!.map((link) => (
            <li key={link.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span>
                {STATUS_LABEL[link.status]} · até {format(parseISO(link.expiresAt), "d MMM yyyy", { locale: ptBR })}
              </span>
              {link.status === "active" && (
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => revoke.mutate(link.id)} disabled={revoke.isPending}>
                  Revogar
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
