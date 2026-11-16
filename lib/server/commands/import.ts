import "server-only"
import { nanoid } from "nanoid"
import { z } from "zod"
import { generate } from "@/lib/ai/client"
import { IMPORT_SYSTEM_INSTRUCTION } from "@/lib/ai/prompts"
import { toGeminiSchema } from "@/lib/ai/schema"
import { DomainError, validation } from "@/lib/domain/errors"
import { ImportResult, MAX_IMPORT_DAYS, MAX_IMPORT_PLACES, type ImportMimeType } from "@/lib/domain/import"
import { CreatePlaceInput, Day, IsoDate, MAX_STOPS_PER_DAY, Place } from "@/lib/domain/schemas"
import { requireTripAccess, tripRef, type SessionUser } from "../authz"
import { firestore } from "../firebase"
import { nowIso, readDoc, toFirestore } from "../firestore-io"

/** Sends the file to Gemini (native PDF/DOCX/image input) and returns validated data. Writes nothing. */
export async function extractItinerary(file: { mimeType: ImportMimeType; data: Buffer }): Promise<ImportResult> {
  const result = await generate(
    "import",
    [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: file.mimeType, data: file.data.toString("base64") } },
          { text: "Extraia os lugares e o roteiro deste documento." },
        ],
      },
    ],
    {
      systemInstruction: IMPORT_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseJsonSchema: toGeminiSchema(ImportResult),
    },
  )
  let json: unknown
  try {
    json = JSON.parse(result.text)
  } catch {
    throw new DomainError("VALIDATION", "A IA não retornou um resultado válido. Tente outro arquivo.")
  }
  const parsed = ImportResult.safeParse(json)
  if (!parsed.success) throw new DomainError("VALIDATION", "Não foi possível interpretar o documento.")
  return parsed.data
}

/** Reviewed import, written in one batch: new Places plus Days (merged by date) with Stops. */
export const CommitImportInput = z.object({
  places: z.array(CreatePlaceInput).max(MAX_IMPORT_PLACES),
  days: z
    .array(
      z.object({
        date: IsoDate,
        /** Indexes into `places`. */
        placeIndexes: z.array(z.number().int().nonnegative()).max(MAX_STOPS_PER_DAY),
      }),
    )
    .max(MAX_IMPORT_DAYS),
})
export type CommitImportInput = z.infer<typeof CommitImportInput>

export async function commitImport(
  user: SessionUser,
  tripId: string,
  input: CommitImportInput,
): Promise<{ placeIds: string[]; dayIds: string[] }> {
  if (input.days.some((d) => d.placeIndexes.some((i) => i >= input.places.length))) {
    throw validation("Índice de local inválido")
  }
  return firestore.runTransaction(async (tx) => {
    await requireTripAccess(tripId, user.id, "editor", tx)
    const ref = tripRef(tripId)
    const existingDays = (await tx.get(ref.collection("days"))).docs.map((d) => readDoc(Day, d))
    const now = nowIso()

    const placeIds = input.places.map((place) => {
      const doc = ref.collection("places").doc()
      tx.set(
        doc,
        toFirestore(
          Place.parse({ ...place, id: doc.id, visited: false, source: "import", createdBy: user.id, createdAt: now, updatedAt: now }),
        ),
      )
      return doc.id
    })

    const dayIds: string[] = []
    const merged = new Map<string, number[]>()
    for (const d of input.days) merged.set(d.date, [...(merged.get(d.date) ?? []), ...d.placeIndexes])
    for (const [date, indexes] of merged) {
      const newStops = indexes.map((i) => ({ id: nanoid(12), placeId: placeIds[i] }))
      const existing = existingDays.find((d) => d.date === date)
      if (existing) {
        const stops = [...existing.stops, ...newStops]
        if (stops.length > MAX_STOPS_PER_DAY) throw validation(`O dia ${date} passaria de ${MAX_STOPS_PER_DAY} paradas`)
        tx.update(ref.collection("days").doc(existing.id), { stops, version: existing.version + 1, updatedAt: now, updatedBy: user.id })
        dayIds.push(existing.id)
      } else {
        const doc = ref.collection("days").doc()
        tx.set(
          doc,
          toFirestore(
            Day.parse({ id: doc.id, date, travelMode: "WALK", stops: newStops, version: 0, route: null, createdAt: now, updatedAt: now, updatedBy: user.id }),
          ),
        )
        dayIds.push(doc.id)
      }
    }
    tx.update(ref, { updatedAt: now })
    return { placeIds, dayIds }
  })
}
