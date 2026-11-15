import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const root = fileURLToPath(new URL(".", import.meta.url))

const shared = {
  resolve: {
    alias: {
      "@": root,
      // "server-only" throws outside the react-server condition; tests run in plain Node.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
}

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        ...shared,
        test: {
          name: "unit",
          environment: "node",
          include: ["lib/**/*.test.ts", "tests/unit/**/*.test.ts"],
        },
      },
      {
        ...shared,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          // Integration tests share one Firestore emulator; run files serially.
          fileParallelism: false,
        },
      },
    ],
  },
})
