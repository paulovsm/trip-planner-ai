import { addDays, format, parseISO } from "date-fns"
import type { ImportedDay } from "@/lib/domain/import"
import type { CreatePlaceInput } from "@/lib/domain/schemas"
import type { CommitImportInput } from "./api"

export type DraftPlace = Omit<CreatePlaceInput, "location"> & { location?: { lat: number; lng: number } }

/**
 * Turns reviewed import data into a commit payload: only located places are saved;
 * days get a date from the document or from the trip start date + (dayNumber - 1).
 */
export function buildImportCommit(
  places: DraftPlace[],
  days: ImportedDay[],
  startDate?: string,
): { commit: CommitImportInput; skippedPlaces: number; skippedDays: number } {
  const located = places.filter((p): p is CreatePlaceInput => !!p.location)
  const indexByName = new Map(located.map((p, i) => [p.name.trim().toLowerCase(), i]))

  let skippedDays = 0
  const commitDays: CommitImportInput["days"] = []
  for (const day of days) {
    const date = day.date ?? (startDate ? format(addDays(parseISO(startDate), day.dayNumber - 1), "yyyy-MM-dd") : null)
    if (!date) {
      skippedDays++
      continue
    }
    const placeIndexes = day.places
      .map((name) => indexByName.get(name.trim().toLowerCase()))
      .filter((i): i is number => i !== undefined)
    commitDays.push({ date, placeIndexes: [...new Set(placeIndexes)] })
  }

  return {
    commit: { places: located, days: commitDays },
    skippedPlaces: places.length - located.length,
    skippedDays,
  }
}
