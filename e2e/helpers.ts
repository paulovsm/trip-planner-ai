import { test as base, expect, type APIRequestContext, type BrowserContext } from "@playwright/test"
import { encode } from "next-auth/jwt"

const SALT = "authjs.session-token"

function secret() {
  if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
    try {
      process.loadEnvFile(".env")
    } catch {
      // CI provides AUTH_SECRET in the environment
    }
  }
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!s) throw new Error("AUTH_SECRET is required for e2e")
  return s
}

/** Mints an Auth.js session cookie (no test-only login provider in production code). */
export async function sessionCookie(user: { id: string; email: string }) {
  const value = await encode({ token: { sub: user.id, email: user.email, name: user.id }, secret: secret(), salt: SALT })
  return { name: SALT, value, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" as const }
}

export async function signIn(context: BrowserContext, user: { id: string; email: string }) {
  await context.addCookies([await sessionCookie(user)])
}

const ts = Date.now().toString(36)
export const alice = { id: `e2e-alice-${ts}`, email: `alice-${ts}@example.com` }

type Seeded = { tripId: string; dayId: string; stopIds: string[]; placeIds: string[] }

/** Creates a trip with three places and one day through the real API. */
export async function seedTrip(request: APIRequestContext, name = "Lisboa E2E"): Promise<Seeded> {
  const post = async (path: string, data: unknown) => {
    const res = await request.post(path, { data })
    expect(res.status(), `${path}: ${await res.text()}`).toBe(201)
    return res.json()
  }
  const trip = await post("/api/trips", { name, startDate: "2026-12-03", endDate: "2026-12-05" })
  const places = [
    await post(`/api/trips/${trip.id}/places`, { name: "Torre de Belém", category: "historia", city: "Lisboa", location: { lat: 38.6916, lng: -9.216 } }),
    await post(`/api/trips/${trip.id}/places`, { name: "Mosteiro dos Jerónimos", category: "historia", city: "Lisboa", location: { lat: 38.6979, lng: -9.2068 } }),
    await post(`/api/trips/${trip.id}/places`, { name: "LX Factory", category: "compras", city: "Lisboa", location: { lat: 38.7036, lng: -9.1784 } }),
  ]
  const day = await post(`/api/trips/${trip.id}/days`, { date: "2026-12-03" })
  let last = day
  for (const p of places) last = await post(`/api/trips/${trip.id}/days/${day.id}/stops`, { placeId: p.id })
  return { tripId: trip.id, dayId: day.id, stopIds: last.stops.map((s: { id: string }) => s.id), placeIds: places.map((p) => p.id) }
}

export const test = base.extend<{ authed: void }>({
  authed: [
    async ({ context }, use) => {
      await signIn(context, alice)
      await use()
    },
    { auto: true },
  ],
})
export { expect }
