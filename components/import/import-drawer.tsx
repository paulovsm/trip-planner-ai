"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { FileUp } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { useTrip } from "@/components/trip/trip-context"
import { api, errorMessage, queryKeys, type CommitImportInput } from "@/lib/client/api"
import type { ImportPreview } from "@/lib/domain/import"
import { ImportReview } from "./import-review"
import { ImportUpload } from "./import-upload"

/** Import a document or photo into an existing Trip (upload → review → commit). */
export function ImportDrawer() {
  const { tripId, detail } = useTrip()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<ImportPreview | null>(null)

  const commit = useMutation({
    mutationFn: (input: CommitImportInput) => api.import.commit(tripId, input),
    onSuccess: (res) => {
      toast.success(`${res.placeIds.length} ${res.placeIds.length === 1 ? "lugar importado" : "lugares importados"}.`)
      qc.invalidateQueries({ queryKey: queryKeys.trip(tripId) })
      setPreview(null)
      setOpen(false)
    },
    onError: (err) => toast.error(errorMessage(err, "Erro ao salvar a importação.")),
  })

  return (
    <>
      <Button variant="outline" className="w-full justify-start" onClick={() => setOpen(true)}>
        <FileUp /> Importar documento ou foto
      </Button>
      <ResponsiveDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) setPreview(null)
        }}
        title={preview ? "Revisar importação" : "Importar para a viagem"}
        description={preview ? "Nada é salvo até você confirmar." : undefined}
      >
        {preview ? (
          <ImportReview
            preview={preview}
            startDate={detail.trip.startDate}
            submitting={commit.isPending}
            onSubmit={(c) => commit.mutate(c)}
            onCancel={() => setPreview(null)}
          />
        ) : (
          <ImportUpload onPreview={setPreview} />
        )}
      </ResponsiveDialog>
    </>
  )
}
