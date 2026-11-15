import "server-only"
import type { DocumentReference, Transaction } from "firebase-admin/firestore"
import { auth } from "@/auth"
import { checkTripAccess } from "@/lib/domain/access"
import { DomainError } from "@/lib/domain/errors"
import { Trip, type Role } from "@/lib/domain/schemas"
import { firestore } from "./firebase"
import { readDoc } from "./firestore-io"

export type SessionUser = { id: string; email: string }

export async function requireUser(): Promise<SessionUser> {
  const session = await auth()
  const id = session?.user?.id
  const email = session?.user?.email
  if (!id || !email) throw new DomainError("UNAUTHORIZED", "Faça login para continuar")
  return { id, email: email.toLowerCase() }
}

export const tripRef = (tripId: string) => firestore.collection("trips").doc(tripId)

/**
 * Loads a Trip and checks the user's role. Pass `tx` to read inside a transaction
 * (so the membership check and the write are atomic).
 */
export async function requireTripAccess(
  tripId: string,
  userId: string,
  role: Role = "editor",
  tx?: Transaction,
): Promise<{ trip: Trip; ref: DocumentReference; role: Role }> {
  const ref = tripRef(tripId)
  const snap = tx ? await tx.get(ref) : await ref.get()
  const trip = snap.exists ? readDoc(Trip, snap) : null
  const granted = checkTripAccess(trip, userId, role)
  return { trip: trip!, ref, role: granted }
}
