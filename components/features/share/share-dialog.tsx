"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Share2, Copy, Check, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface ShareDialogProps {
  tripId: string
}

export function ShareDialog({ tripId }: ShareDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [hasCopied, setHasCopied] = useState(false)

  const handleCreateLink = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/trips/${tripId}/share`, {
        method: "POST",
      })

      if (!response.ok) throw new Error("Falha ao criar link")

      const data = await response.json()
      const link = `${window.location.origin}/shared/${data.token}`
      setShareLink(link)
    } catch (error) {
      toast.error("Erro ao gerar link de compartilhamento")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink)
      setHasCopied(true)
      toast.success("Link copiado!")
      setTimeout(() => setHasCopied(false), 2000)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Compartilhar">
          <Share2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compartilhar Viagem</DialogTitle>
          <DialogDescription>
            Qualquer pessoa com o link poderá visualizar este roteiro.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="link" className="sr-only">
              Link
            </Label>
            <Input
              id="link"
              defaultValue={shareLink || ""}
              readOnly
              placeholder="Clique em gerar para criar um link"
            />
          </div>
          {shareLink ? (
            <Button type="submit" size="sm" className="px-3" onClick={handleCopy}>
              {hasCopied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              <span className="sr-only">Copiar</span>
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={handleCreateLink} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
