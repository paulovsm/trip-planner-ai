import { defineConfig, devices } from "@playwright/test"

// E2E against the production build, backed by the Firestore emulator (started by
// `npm run e2e`), with fake AI and no Maps key so tests never call external services.
const PORT = 3200
export const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 45_000,
  use: {
    baseURL: BASE_URL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 860 } } },
  ],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: `${BASE_URL}/login`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: {
      FIREBASE_PROJECT_ID: "demo-tripplanner",
      FIRESTORE_DATABASE_ID: "",
      FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080",
      AI_FAKE: "1",
      AUTH_TRUST_HOST: "true",
      AUTH_URL: BASE_URL,
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
})
