import "server-only"
import { Timestamp, type DocumentSnapshot } from "firebase-admin/firestore"
import type { z } from "zod"

/** Recursively converts Firestore Timestamps to ISO strings (the domain's wire format). */
export function fromFirestore(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (Array.isArray(value)) return value.map(fromFirestore)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fromFirestore(v)]))
  }
  return value
}

/** Reads a document and validates it against its domain schema (id comes from the doc). */
export function readDoc<S extends z.ZodType>(schema: S, snap: DocumentSnapshot): z.infer<S> {
  return schema.parse({ ...(fromFirestore(snap.data()) as object), id: snap.id })
}

/** Firestore rejects `undefined`; strip it before writing (and drop the redundant id field). */
export function toFirestore<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || k === "id") continue
    out[k] = v
  }
  return out
}

export const nowIso = () => new Date().toISOString()
