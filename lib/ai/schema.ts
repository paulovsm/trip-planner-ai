import { z } from "zod"

// Gemini 4 structured output rejects size constraints (minLength/maxLength/minItems/
// maxItems/minimum/maximum) with INVALID_ARGUMENT — verified against gemini-4-argon.
// The model gets the shape (types, enums, required, patterns); the limits are still
// enforced by re-validating the response with the same zod schema on the server.
const UNSUPPORTED = new Set(["$schema", "minLength", "maxLength", "minItems", "maxItems", "minimum", "maximum"])

function strip(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strip)
  if (node && typeof node === "object") {
    return Object.fromEntries(
      Object.entries(node)
        .filter(([k]) => !UNSUPPORTED.has(k))
        .map(([k, v]) => [k, strip(v)]),
    )
  }
  return node
}

export function toGeminiSchema(schema: z.ZodType): Record<string, unknown> {
  return strip(z.toJSONSchema(schema)) as Record<string, unknown>
}
