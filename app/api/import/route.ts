import { DomainError } from "@/lib/domain/errors"
import { detectImportType, MAX_IMPORT_BYTES } from "@/lib/domain/import"
import { previewImport } from "@/lib/server/commands/import"
import { withRoute } from "@/lib/server/route"

export const maxDuration = 120

/**
 * Extracts Places/Days from a document with Gemini and resolves them on Google Places.
 * Writes nothing: the client
 * reviews the result and commits it with POST /api/trips/[tripId]/import/commit.
 */
export const POST = withRoute({ auth: "user", rateLimit: "import" }, async ({ req }) => {
  const tooLarge = () => new DomainError("PAYLOAD_TOO_LARGE", "Arquivo maior que 4 MB")
  if (Number(req.headers.get("content-length") ?? 0) > MAX_IMPORT_BYTES + 64 * 1024) throw tooLarge()

  const form = await req.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) throw new DomainError("VALIDATION", "Nenhum arquivo enviado")
  if (file.size > MAX_IMPORT_BYTES) throw tooLarge()

  const data = Buffer.from(await file.arrayBuffer())
  const mimeType = detectImportType(data)
  if (!mimeType) {
    throw new DomainError("UNSUPPORTED_MEDIA_TYPE", "Formato não suportado. Envie PDF, DOCX ou uma imagem (JPG, PNG, WebP, HEIC).")
  }
  return previewImport({ mimeType, data })
})
