"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Camera, FileUp, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { api, errorMessage } from "@/lib/client/api"
import { prepareUpload } from "@/lib/client/resize-image"
import { MAX_IMPORT_BYTES, type ImportPreview, type ImportProgress } from "@/lib/domain/import"
import { cn } from "@/lib/utils"

const ACCEPT = ".pdf,.docx,image/jpeg,image/png,image/webp,image/heic"

/** Upload a PDF/DOCX/photo (or take one with the camera); returns the extracted preview. */
export function ImportUpload({ onPreview }: { onPreview: (preview: ImportPreview) => void }) {
  const id = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [dragging, setDragging] = useState(false)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => () => abort.current?.abort(), [])

  const handle = async (raw?: File | null) => {
    if (!raw) return
    const controller = new AbortController()
    abort.current = controller
    setBusy(true)
    setProgress(null)
    try {
      const file = await prepareUpload(raw)
      if (file.size > MAX_IMPORT_BYTES) {
        toast.error("O arquivo passa de 4 MB. Tente uma versão menor.")
        return
      }
      const preview = await api.import.extract(file, setProgress, controller.signal)
      if (!preview.places.length) toast.warning("Não encontramos lugares neste documento.")
      onPreview(preview)
    } catch (err) {
      if (!controller.signal.aborted) toast.error(errorMessage(err, "Erro ao processar o documento."))
    } finally {
      if (abort.current === controller) abort.current = null
      setBusy(false)
      setProgress(null)
      if (fileInput.current) fileInput.current.value = ""
      if (cameraInput.current) cameraInput.current.value = ""
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        handle(e.dataTransfer.files?.[0])
      }}
      className={cn("space-y-3 rounded-2xl border-2 border-dashed p-5 text-center", dragging && "border-primary bg-primary/5")}
    >
      {busy ? (
        <ImportProgressView progress={progress} />
      ) : (
        <>
          <p className="text-sm">
            Envie uma reserva, um roteiro em PDF/DOCX ou uma <strong>foto</strong> de um guia ou anotação.
            <span className="text-muted-foreground block text-xs">Até 4 MB · fotos são reduzidas automaticamente.</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}>
              <FileUp /> Arquivo
            </Button>
            <Button type="button" variant="outline" onClick={() => cameraInput.current?.click()}>
              <Camera /> Câmera
            </Button>
          </div>
        </>
      )}
      <input
        ref={fileInput}
        id={`${id}-file`}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-label="Escolher arquivo para importar"
        onChange={(e) => handle(e.target.files?.[0])}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="Tirar foto para importar"
        onChange={(e) => handle(e.target.files?.[0])}
      />
    </div>
  )
}

function ImportProgressView({ progress }: { progress: ImportProgress | null }) {
  const locating = progress?.stage === "locating" ? progress : null
  const found = progress?.stage === "reading" ? progress.found : 0
  const label = locating
    ? `Localizando os lugares no mapa… ${locating.done} de ${locating.total}`
    : found > 0
      ? `Lendo o documento com IA… ${found} ${found === 1 ? "lugar encontrado" : "lugares encontrados"}`
      : "Lendo o documento com IA…"
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-2 py-4 text-sm">
      <Loader2 className="size-6 animate-spin" aria-hidden />
      <p className="text-foreground font-medium" role="status" aria-live="polite">
        {label}
      </p>
      {locating && (
        <div
          className="bg-muted h-1.5 w-full max-w-60 overflow-hidden rounded-full"
          role="progressbar"
          aria-label="Lugares localizados"
          aria-valuemin={0}
          aria-valuemax={locating.total}
          aria-valuenow={locating.done}
        >
          <div className="bg-primary h-full transition-[width]" style={{ width: `${(locating.done / locating.total) * 100}%` }} />
        </div>
      )}
      <p className="text-xs">Roteiros longos levam cerca de 1 minuto. Mantenha esta tela aberta.</p>
    </div>
  )
}
