import { DomainError } from "@/lib/domain/errors"
import { detectImportType, MAX_IMPORT_BYTES, type ImportEvent } from "@/lib/domain/import"
import { previewImport } from "@/lib/server/commands/import"
import { withRoute } from "@/lib/server/route"

// A long itinerary takes ~40-60 s (Gemini plus Places); 300 s leaves room for a
// timeout on the primary model followed by the fallback.
export const maxDuration = 300

const HEARTBEAT_MS = 10_000

/**
 * Extracts Places/Days from a document with Gemini and resolves them on Google Places.
 * Writes nothing: the client reviews the result and commits it with
 * POST /api/trips/[tripId]/import/commit.
 *
 * The file is validated before the response starts; the work is then streamed as NDJSON
 * ImportEvents (progress…, then result or error), which also keeps mobile connections
 * from idling out during a long extraction.
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

  const encoder = new TextEncoder()
  const abort = new AbortController()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      let last: ImportEvent = { type: "progress", stage: "reading", found: 0 }
      const send = (event: ImportEvent) => {
        if (closed) return
        if (event.type === "progress") last = event
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"))
        } catch {
          closed = true // the client went away
        }
      }
      send(last)
      const heartbeat = setInterval(() => send(last), HEARTBEAT_MS)
      try {
        send({ type: "result", preview: await previewImport({ mimeType, data }, send, abort.signal) })
      } catch (err) {
        if (!abort.signal.aborted) {
          if (!(err instanceof DomainError)) console.error("[api] import failed", err)
          send({
            type: "error",
            message:
              err instanceof DomainError
                ? err.message
                : (err as Error)?.name === "AbortError" || (err as Error)?.name === "TimeoutError"
                  ? "O documento demorou demais para ser lido. Tente um arquivo menor ou divida o roteiro."
                  : "Erro ao processar o documento. Tente novamente.",
          })
        }
      } finally {
        clearInterval(heartbeat)
        if (!closed) controller.close()
        closed = true
      }
    },
    cancel() {
      abort.abort()
    },
  })
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  })
})
