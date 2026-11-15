import "server-only"
import { createHash } from "node:crypto"
import { DomainError } from "@/lib/domain/errors"
import { firestore } from "./firebase"

export type RateLimitBucket = "ai-chat" | "ai-proposal-apply" | "import" | "share-public" | "maps-routes"

export const RATE_LIMITS: Record<RateLimitBucket, number> = {
  "ai-chat": 10,
  "ai-proposal-apply": 30,
  import: 3,
  "share-public": 60,
  "maps-routes": 20,
}

/** Salted hash so raw IPs are never stored. */
export function hashIp(ip: string): string {
  const salt = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "dev"
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32)
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown"
}

/**
 * Fixed one-minute window counter in Firestore (`rateLimits` has a TTL policy on
 * `expiresAt`). Anti-abuse only; there are no daily quotas (decision Q25).
 */
export async function enforceRateLimit(bucket: RateLimitBucket, key: string, limit = RATE_LIMITS[bucket]) {
  const minute = Math.floor(Date.now() / 60_000)
  const ref = firestore.collection("rateLimits").doc(`${bucket}:${key}:${minute}`)
  const allowed = await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const count = (snap.get("count") as number | undefined) ?? 0
    if (count >= limit) return false
    tx.set(ref, { count: count + 1, expiresAt: new Date((minute + 2) * 60_000) })
    return true
  })
  if (!allowed) throw new DomainError("RATE_LIMITED", "Muitas requisições. Aguarde um minuto e tente de novo.")
}
