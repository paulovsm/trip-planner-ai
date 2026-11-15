import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

// Every API route must go through withRoute (auth, validation, rate limit, errors).
// Only the Auth.js handler is exempt.

const API_DIR = join(process.cwd(), "app/api")
const EXEMPT = new Set(["auth/[...nextauth]/route.ts"])

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name)
    return e.isDirectory() ? routeFiles(path) : e.name === "route.ts" ? [path] : []
  })
}

describe("API routes", () => {
  const files = routeFiles(API_DIR).filter((f) => !EXEMPT.has(relative(API_DIR, f)))

  it("exist", () => expect(files.length).toBeGreaterThan(10))

  for (const file of files) {
    it(`${relative(API_DIR, file)} wraps every handler in withRoute`, () => {
      const src = readFileSync(file, "utf8")
      expect(src).not.toMatch(/export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/)
      const handlers = [...src.matchAll(/export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=\s*(\w+)/g)]
      expect(handlers.length).toBeGreaterThan(0)
      for (const [, method, wrapper] of handlers) expect({ method, wrapper }).toEqual({ method, wrapper: "withRoute" })
    })
  }
})
