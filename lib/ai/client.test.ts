import { ApiError, ThinkingLevel } from "@google/genai"
import { describe, expect, it } from "vitest"
import { isRetriable, stripThoughts, taskConfig } from "./client"

describe("taskConfig", () => {
  it("defaults to Argon with Hydrogen fallback and per-task thinking", () => {
    expect(taskConfig("chat", {})).toEqual({
      model: "gemini-4-argon",
      fallbackModel: "gemini-4-hydrogen",
      thinkingLevel: ThinkingLevel.LOW,
      timeoutMs: 45_000,
    })
    expect(taskConfig("import", {}).thinkingLevel).toBe(ThinkingLevel.HIGH)
  })

  it("is overridable per task via env", () => {
    const cfg = taskConfig("chat", {
      GEMINI_MODEL_CHAT: "gemini-4-hydrogen",
      GEMINI_THINKING_CHAT: "minimal",
      GEMINI_TIMEOUT_CHAT_MS: "5000",
      GEMINI_MODEL_FALLBACK: "gemini-3.5-flash-lite",
    })
    expect(cfg).toEqual({
      model: "gemini-4-hydrogen",
      fallbackModel: "gemini-3.5-flash-lite",
      thinkingLevel: ThinkingLevel.MINIMAL,
      timeoutMs: 5000,
    })
  })

  it("ignores invalid thinking levels", () => {
    expect(taskConfig("agent", { GEMINI_THINKING_AGENT: "extreme" }).thinkingLevel).toBe(ThinkingLevel.MEDIUM)
  })
})

describe("isRetriable", () => {
  it("retries 404 (retired model), 429, 5xx and timeouts only", () => {
    expect(isRetriable(new ApiError({ message: "x", status: 404 }))).toBe(true)
    expect(isRetriable(new ApiError({ message: "x", status: 429 }))).toBe(true)
    expect(isRetriable(new ApiError({ message: "x", status: 503 }))).toBe(true)
    expect(isRetriable(new ApiError({ message: "x", status: 400 }))).toBe(false)
    expect(isRetriable(Object.assign(new Error("t"), { name: "TimeoutError" }))).toBe(true)
    expect(isRetriable(new Error("boom"))).toBe(false)
  })
})

describe("stripThoughts", () => {
  it("removes thought parts and signatures before switching models", () => {
    const out = stripThoughts([
      {
        role: "model",
        parts: [{ text: "pensando", thought: true }, { text: "Resposta", thoughtSignature: "c2ln" }],
      },
    ])
    expect(out).toEqual([{ role: "model", parts: [{ text: "Resposta" }] }])
  })
})
