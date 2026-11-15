import { afterAll, beforeEach, vi } from "vitest"

// Integration tests call the server commands directly with a SessionUser, so the
// Auth.js runtime is not needed. They require the Firestore emulator
// (run through `npm run test:int`, which sets FIRESTORE_EMULATOR_HOST).
vi.mock("@/auth", () => ({ auth: async () => null, handlers: {}, signIn: vi.fn(), signOut: vi.fn() }))

const host = process.env.FIRESTORE_EMULATOR_HOST
const projectId = process.env.FIREBASE_PROJECT_ID || "demo-tripplanner"
if (!host) throw new Error("FIRESTORE_EMULATOR_HOST is not set — run `npm run test:int`")

beforeEach(async () => {
  const res = await fetch(`http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error(`Failed to reset emulator: ${res.status}`)
})

afterAll(() => {
  vi.restoreAllMocks()
})
