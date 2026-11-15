import { z } from "zod"
import { IsoDate, PlaceCategory } from "./schemas"

// Structured output requested from Gemini for document import (and re-validated).

export const MAX_IMPORT_BYTES = 4 * 1024 * 1024 // Vercel caps request bodies at ~4.5 MB
export const MAX_IMPORT_PLACES = 200
export const MAX_IMPORT_DAYS = 60

export const ImportedPlace = z.object({
  name: z.string().trim().min(1).max(200),
  category: PlaceCategory,
  description: z.string().trim().max(2000).optional(),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(120).optional(),
})

export const ImportedDay = z.object({
  dayNumber: z.number().int().min(1).max(366),
  date: IsoDate.nullable().optional(),
  places: z.array(z.string().trim().min(1).max(200)).max(50),
})

export const ImportResult = z.object({
  places: z.array(ImportedPlace).max(MAX_IMPORT_PLACES),
  days: z.array(ImportedDay).max(MAX_IMPORT_DAYS),
})

export type ImportedPlace = z.infer<typeof ImportedPlace>
export type ImportedDay = z.infer<typeof ImportedDay>
export type ImportResult = z.infer<typeof ImportResult>

export const SUPPORTED_IMPORT_TYPES = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "image/heic": "HEIC",
} as const

export type ImportMimeType = keyof typeof SUPPORTED_IMPORT_TYPES

const startsWith = (buf: Uint8Array, bytes: number[], offset = 0) => bytes.every((b, i) => buf[offset + i] === b)
const ascii = (buf: Uint8Array, start: number, end: number) => String.fromCharCode(...buf.subarray(start, end))

/** Detects the real file type from magic bytes (never trust the client's MIME type). */
export function detectImportType(buf: Uint8Array): ImportMimeType | null {
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf" // %PDF-
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "image/jpeg"
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png"
  if (ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WEBP") return "image/webp"
  if (ascii(buf, 4, 8) === "ftyp" && ["heic", "heix", "mif1", "msf1"].includes(ascii(buf, 8, 12))) return "image/heic"
  // DOCX = ZIP container whose entries include word/document.xml
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) {
    const head = new TextDecoder("latin1").decode(buf.subarray(0, Math.min(buf.length, 64 * 1024)))
    if (head.includes("word/")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  }
  return null
}
