import { expect } from "vitest"
import type { SessionUser } from "@/lib/server/authz"
import { firestore } from "@/lib/server/firebase"

export const alice: SessionUser = { id: "alice", email: "alice@example.com" }
export const bob: SessionUser = { id: "bob", email: "bob@example.com" }
export const carol: SessionUser = { id: "carol", email: "carol@example.com" }

export const belem = { name: "Torre de Belém", category: "historia" as const, location: { lat: 38.6916, lng: -9.216 } }
export const jeronimos = {
  name: "Mosteiro dos Jerónimos",
  category: "historia" as const,
  location: { lat: 38.6979, lng: -9.2068 },
}
export const lxFactory = { name: "LX Factory", category: "compras" as const, location: { lat: 38.7036, lng: -9.1784 } }

/** Simulates an Auth.js adapter user so invites can resolve emails to ids. */
export async function registerUser(user: SessionUser) {
  await firestore.collection("users").doc(user.id).set({ email: user.email, name: user.id })
}

export async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ code })
}
