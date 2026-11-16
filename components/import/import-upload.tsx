"use client"

import { useId, useRef, useState } from "react"
import { Camera, FileUp, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { api, errorMessage } from "@/lib/client/api"
import { prepareUpload } from "@/lib/client/resize-image"
import { MAX_IMPORT_BYTES, type ImportPreview } from "@/lib/domain/import"
import { cn } from "@/lib/utils"

const ACCEPT = ".pdf,.docx,image/jpeg,image/png,image/webp,image/heic"

/** Upload a PDF/DOCX/photo (or take one with the camera); returns the extracted preview. */
export function ImportUpload({ onPreview }: { onPreview: (preview: ImportPreview) => void }) {
  const id = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)

  const handle = async (raw?: File | null) => {
    if (!raw) return
    setBusy(true)
    try {
      const file = await prepareUpload(raw)
      if (file.size > MAX_IMPORT_BYTES) {
        toast.error("O arquivo passa de 4 MB. Tente uma versão menor.")
        return
      }
      const preview = await api.import.extract(file)
      if (!preview.places.length) toast.warning("Não encontramos lugares neste documento.")
      onPreview(preview)
    } catch (err) {
      toast.error(errorMessage(err, "Erro ao processar o documento."))
    } finally {
      setBusy(false)
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
        <div className="text-muted-foreground flex flex-col items-center gap-2 py-4 text-sm" role="status">
          <Loader2 className="size-6 animate-spin" />
          Lendo o documento com IA e localizando os lugares… isso pode levar alguns segundos.
        </div>
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
