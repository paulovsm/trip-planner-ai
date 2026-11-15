"use client"

import { useId, useState } from "react"
import { FileText, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, errorMessage } from "@/lib/client/api"
import { MAX_IMPORT_BYTES, type ImportResult } from "@/lib/domain/import"

const ACCEPT = ".pdf,.docx,image/jpeg,image/png,image/webp,image/heic"

export function DocumentImporter({ onImport }: { onImport: (data: ImportResult) => void | Promise<void> }) {
  const id = useId()
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      toast.error("Selecione um arquivo.")
      return
    }
    if (file.size > MAX_IMPORT_BYTES) {
      toast.error("O arquivo passa de 4 MB. Tente uma versão menor ou uma foto com menos resolução.")
      return
    }
    setIsUploading(true)
    try {
      const data = await api.import.extract(file)
      await onImport(data)
      toast.success(`${data.places.length} lugares encontrados no documento.`)
      setFile(null)
      ;(e.target as HTMLFormElement).reset()
    } catch (error) {
      toast.error(errorMessage(error, "Erro ao processar documento. Tente novamente."))
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Importar Roteiro
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${id}-file`}>PDF, DOCX ou foto do roteiro (até 4 MB)</Label>
            <Input
              id={`${id}-file`}
              type="file"
              accept={ACCEPT}
              disabled={isUploading}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button type="submit" disabled={isUploading || !file} className="w-full">
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Importar e Extrair
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
