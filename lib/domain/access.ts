import { DomainError, notFound } from "./errors"
import type { Role, Trip } from "./schemas"

const RANK: Record<Role, number> = { editor: 1, owner: 2 }

/**
 * Authorization decision for a Trip. Non-members get NOT_FOUND (not FORBIDDEN) so
 * that Trip ids cannot be probed; members lacking the role get FORBIDDEN.
 */
export function checkTripAccess(trip: Pick<Trip, "members"> | null, userId: string, required: Role): Role {
  const member = trip?.members[userId]
  if (!trip || !member) throw notFound("Viagem")
  if (RANK[member.role] < RANK[required]) {
    throw new DomainError("FORBIDDEN", "Apenas o dono da viagem pode fazer isso")
  }
  return member.role
}
