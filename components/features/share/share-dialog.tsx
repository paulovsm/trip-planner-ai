"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Check, Copy, Loader2, Share2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, errorMessage, queryKeys } from "@/lib/client/api"

const EXPIRY_OPTIONS = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
  { days: 365, label: "1 ano" },
]

const STATUS_LABEL = { active: "Ativo", expired: "Expirado", revoked: "Revogado" } as const

export function ShareDialog({ tripId }: { tripId: string }) {
  const qc = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [expiresInDays, setExpiresInDays] = useState(30)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [hasCopied, setHasCopied] = useState(false)

  const links = useQuery({
    queryKey: queryKeys.shareLinks(tripId),
    queryFn: () => api.shareLinks.list(tripId),
    enabled: isOpen,
  })

  const create = useMutation({
    mutationFn: () => api.shareLinks.create(tripId, expiresInDays),
    onSuccess: (link) => {
      setShareUrl(`${window.location.origin}${link.path}`)
      qc.invalidateQueries({ queryKey: queryKeys.shareLinks(tripId) })
    },
    onError: (err) => toast.error(errorMessage(err, "Erro ao gerar link de compartilhamento")),
  })

  const revoke = useMutation({
    mutationFn: (linkId: string) => api.shareLinks.revoke(tripId, linkId),
    onSuccess: () => {
      toast.success("Link revogado.")
      qc.invalidateQueries({ queryKey: queryKeys.shareLinks(tripId) })
    },
    onError: (err) => toast.error(errorMessage(err, "Erro ao revogar link")),
  })

  const handleCopy = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setHasCopied(true)
    toast.success("Link copiado!")
    setTimeout(() => setHasCopied(false), 2000)
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) setShareUrl(null) // the token is shown only once
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Compartilhar" aria-label="Compartilhar">
          <Share2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compartilhar viagem</DialogTitle>
          <DialogDescription>
            Quem tiver o link vê o roteiro (sem notas das paradas) e não pode editar. Copie o link agora: por segurança
            ele não poderá ser exibido de novo.
          </DialogDescription>
        </DialogHeader>

        {shareUrl ? (
          <div className="flex items-center gap-2">
            <Label htmlFor="share-link" className="sr-only">
              Link
            </Label>
            <Input id="share-link" value={shareUrl} readOnly onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" size="sm" className="px-3" onClick={handleCopy} aria-label="Copiar link">
              {hasCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="share-expiry">Validade</Label>
              <select
                id="share-expiry"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                className="border-input bg-transparent dark:bg-input/30 h-9 w-full rounded-md border px-3 text-sm"
              >
                {EXPIRY_OPTIONS.map((o) => (
                  <option key={o.days} value={o.days}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <Button type="button" onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar link"}
            </Button>
          </div>
        )}

        {(links.data?.length ?? 0) > 0 && (
          <div className="space-y-2 pt-2">
            <h3 className="text-sm font-medium">Links criados</h3>
            <ul className="space-y-1 text-sm">
              {links.data!.map((link) => (
                <li key={link.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <span>
                    {STATUS_LABEL[link.status]} · expira em{" "}
                    {format(parseISO(link.expiresAt), "d 'de' MMM yyyy", { locale: ptBR })}
                  </span>
                  {link.status === "active" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => revoke.mutate(link.id)}
                      disabled={revoke.isPending}
                    >
                      Revogar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
