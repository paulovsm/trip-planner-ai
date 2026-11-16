import type { PreviewPlace } from "@/lib/domain/import"
import type { CommitImportInput } from "./api"

export type ReviewRow = PreviewPlace & { key: string; include: boolean }
export type ReviewDay = { key: string; dayNumber: number; date: string; places: string[] }

/**
 * Commit payload from the reviewed import: only included places with a location;
 * days without a date (or without any kept place) are dropped; names match
 * case-insensitively and duplicates are removed.
 */
export function toCommit(rows: ReviewRow[], days: ReviewDay[]): CommitImportInput {
  const kept = rows.filter((r) => r.include && r.location)
  const index = new Map(kept.map((r, i) => [r.name.trim().toLowerCase(), i]))
  return {
    places: kept.map((r) => ({
      name: r.name.trim(),
      category: r.category,
      description: r.description || undefined,
      address: r.address || undefined,
      city: r.city || undefined,
      location: r.location!,
      googlePlaceId: r.googlePlaceId,
    })),
    days: days
      .filter((d) => d.date)
      .map((d) => ({
        date: d.date,
        placeIndexes: [
          ...new Set(d.places.map((n) => index.get(n.trim().toLowerCase())).filter((i): i is number => i !== undefined)),
        ],
      }))
      .filter((d) => d.placeIndexes.length > 0),
  }
}
