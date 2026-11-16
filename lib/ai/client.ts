import "server-only"
import {
  ApiError,
  GoogleGenAI,
  ThinkingLevel,
  type Content,
  type GenerateContentConfig,
  type GenerateContentResponse,
} from "@google/genai"

// Gemini access for every AI task (decision Q13): gemini-4-argon by default, with an
// automatic fallback to gemini-4-hydrogen on errors/timeouts. Model, thinking level
// and timeout are configurable per task via env. temperature/topP/topK are
// deprecated for these models and are never sent.

export type AiTask = "chat" | "import" | "agent"

const PRIMARY_MODEL = "gemini-4-argon"
const FALLBACK_MODEL = "gemini-4-hydrogen"

const DEFAULTS: Record<AiTask, { thinkingLevel: ThinkingLevel; timeoutMs: number }> = {
  chat: { thinkingLevel: ThinkingLevel.LOW, timeoutMs: 45_000 },
  import: { thinkingLevel: ThinkingLevel.HIGH, timeoutMs: 90_000 },
  // Measured live (2026-11-16): Argon agent turns took ~44-61 s at MEDIUM vs ~20-42 s at LOW;
  // gemini-4-hydrogen at LOW took 4-7 s with the same proposals. MINIMAL is rejected by Argon.
  agent: { thinkingLevel: ThinkingLevel.LOW, timeoutMs: 60_000 },
}

export type TaskConfig = { model: string; fallbackModel: string; thinkingLevel: ThinkingLevel; timeoutMs: number }

export function taskConfig(task: AiTask, env: Record<string, string | undefined> = process.env): TaskConfig {
  const key = task.toUpperCase()
  const level = env[`GEMINI_THINKING_${key}`]?.toUpperCase()
  return {
    model: env[`GEMINI_MODEL_${key}`] || PRIMARY_MODEL,
    fallbackModel: env.GEMINI_MODEL_FALLBACK || FALLBACK_MODEL,
    thinkingLevel:
      level && level in ThinkingLevel ? ThinkingLevel[level as keyof typeof ThinkingLevel] : DEFAULTS[task].thinkingLevel,
    timeoutMs: Number(env[`GEMINI_TIMEOUT_${key}_MS`]) || DEFAULTS[task].timeoutMs,
  }
}

export type AiResult = {
  text: string
  /** Raw model turn (keeps thoughtSignature parts needed for multi-turn tool use). */
  content: Content
  model: string
  usedFallback: boolean
  grounding?: { title?: string; uri?: string }[]
}

let client: GoogleGenAI | null = null
const getClient = () => (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }))

/** Errors worth retrying on the fallback model. */
export function isRetriable(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 404 || err.status === 429 || err.status >= 500
  const name = (err as { name?: string })?.name
  return name === "AbortError" || name === "TimeoutError"
}

/**
 * Gemini 4 requires a thought signature on every functionCall in the history, and
 * rejects histories where they were removed (verified by scripts/ai-probe.ts: the
 * Hydrogen fallback accepts Argon's signatures as-is). If a model still rejects a
 * signature, the documented escape hatch is a dummy signature on functionCall parts.
 */
export const DUMMY_SIGNATURE = "skip_thought_signature_validator"

export function withDummySignatures(contents: Content[]): Content[] {
  return contents.map((c) => ({
    ...c,
    parts: (c.parts ?? []).map((p) => (p.functionCall ? { ...p, thoughtSignature: DUMMY_SIGNATURE } : p)),
  }))
}

const isSignatureError = (err: unknown) =>
  err instanceof ApiError && err.status === 400 && /thought_signature/i.test(err.message)

function toResult(res: GenerateContentResponse, model: string, usedFallback: boolean): AiResult {
  const candidate = res.candidates?.[0]
  const content: Content = candidate?.content ?? { role: "model", parts: [{ text: res.text ?? "" }] }
  const chunks = candidate?.groundingMetadata?.groundingChunks ?? []
  const grounding = chunks.flatMap((c) => (c.web ? [{ title: c.web.title, uri: c.web.uri }] : []))
  return { text: res.text ?? "", content, model, usedFallback, grounding: grounding.length ? grounding : undefined }
}

async function fakeGenerate(task: AiTask, contents: Content[]): Promise<AiResult> {
  const last = contents.at(-1)?.parts?.map((p) => p.text ?? "").join(" ") ?? ""
  const text =
    task === "import"
      ? JSON.stringify({
          places: [{ name: "Torre de Belém", category: "historia", city: "Lisboa" }],
          days: [{ dayNumber: 1, places: ["Torre de Belém"] }],
        })
      : `Resposta de teste para: ${last.slice(0, 80)}`
  return { text, content: { role: "model", parts: [{ text }] }, model: "fake", usedFallback: false }
}

export async function generate(
  task: AiTask,
  contents: Content[],
  config: Omit<GenerateContentConfig, "abortSignal" | "thinkingConfig" | "temperature" | "topP" | "topK"> = {},
): Promise<AiResult> {
  if (process.env.AI_FAKE === "1") return fakeGenerate(task, contents)

  const cfg = taskConfig(task)
  const call = (model: string, body: Content[]) =>
    getClient().models.generateContent({
      model,
      contents: body,
      config: {
        ...config,
        thinkingConfig: { thinkingLevel: cfg.thinkingLevel },
        abortSignal: AbortSignal.timeout(cfg.timeoutMs),
      },
    })

  const started = Date.now()
  try {
    const res = await call(cfg.model, contents)
    log(task, cfg.model, started, false, res)
    return toResult(res, cfg.model, false)
  } catch (err) {
    if (!isRetriable(err) || cfg.model === cfg.fallbackModel) throw err
    console.warn(`[ai] ${task}: ${cfg.model} failed (${describe(err)}); falling back to ${cfg.fallbackModel}`)
    let res: GenerateContentResponse
    try {
      res = await call(cfg.fallbackModel, contents)
    } catch (fallbackErr) {
      if (!isSignatureError(fallbackErr)) throw fallbackErr
      res = await call(cfg.fallbackModel, withDummySignatures(contents))
    }
    log(task, cfg.fallbackModel, started, true, res)
    return toResult(res, cfg.fallbackModel, true)
  }
}

function describe(err: unknown) {
  if (err instanceof ApiError) return `HTTP ${err.status}`
  return (err as Error)?.name ?? "error"
}

function log(task: AiTask, model: string, started: number, fallback: boolean, res: GenerateContentResponse) {
  const u = res.usageMetadata
  console.info(
    `[ai] task=${task} model=${model} ms=${Date.now() - started} fallback=${fallback} ` +
      `in=${u?.promptTokenCount ?? "?"} out=${u?.candidatesTokenCount ?? "?"} thoughts=${u?.thoughtsTokenCount ?? "?"}`,
  )
}

// ---------- Streaming (agentic chat) ----------

export type StreamResult = { model: string; usedFallback: boolean; stream: AsyncGenerator<GenerateContentResponse> }

/**
 * Streams a model turn. Falls back to the secondary model only if the primary fails
 * before streaming starts (an HTTP error on the initial request).
 */
export async function generateStream(
  task: AiTask,
  contents: Content[],
  config: Omit<GenerateContentConfig, "abortSignal" | "thinkingConfig" | "temperature" | "topP" | "topK"> = {},
  signal?: AbortSignal,
): Promise<StreamResult> {
  if (process.env.AI_FAKE === "1") return { model: "fake", usedFallback: false, stream: fakeAgentStream(contents) }

  const cfg = taskConfig(task)
  const call = (model: string, body: Content[]) =>
    getClient().models.generateContentStream({
      model,
      contents: body,
      config: {
        ...config,
        thinkingConfig: { thinkingLevel: cfg.thinkingLevel },
        abortSignal: signal ? AbortSignal.any([signal, AbortSignal.timeout(cfg.timeoutMs)]) : AbortSignal.timeout(cfg.timeoutMs),
      },
    })
  try {
    return { model: cfg.model, usedFallback: false, stream: await call(cfg.model, contents) }
  } catch (err) {
    if (!isRetriable(err) || cfg.model === cfg.fallbackModel || signal?.aborted) throw err
    console.warn(`[ai] ${task}: ${cfg.model} failed (${describe(err)}); falling back to ${cfg.fallbackModel}`)
    try {
      return { model: cfg.fallbackModel, usedFallback: true, stream: await call(cfg.fallbackModel, contents) }
    } catch (fallbackErr) {
      if (!isSignatureError(fallbackErr)) throw fallbackErr
      return { model: cfg.fallbackModel, usedFallback: true, stream: await call(cfg.fallbackModel, withDummySignatures(contents)) }
    }
  }
}

const response = (parts: NonNullable<Content["parts"]>) =>
  ({ candidates: [{ content: { role: "model", parts } }] }) as unknown as GenerateContentResponse

/**
 * Deterministic agent for tests (AI_FAKE=1):
 * - "...visitad..." → proposeMarkVisited(P1)
 * - "...adicion..." → searchPlaces(text) → proposeAddStop(first result, 2026-12-03)
 * - after a proposal → a short confirmation; otherwise echoes the message.
 */
async function* fakeAgentStream(contents: Content[]): AsyncGenerator<GenerateContentResponse> {
  const last = contents.at(-1)
  const fnResponse = last?.parts?.find((p) => p.functionResponse)?.functionResponse
  const userText = [...contents].reverse().find((c) => c.role === "user" && c.parts?.some((p) => p.text))?.parts?.map((p) => p.text).join(" ") ?? ""

  if (fnResponse?.name === "searchPlaces") {
    const results = (fnResponse.response as { results?: { googlePlaceId: string }[] })?.results ?? []
    yield response(
      results[0]
        ? [{ functionCall: { name: "proposeAddStop", args: { date: "2026-12-03", googlePlaceId: results[0].googlePlaceId, time: "10:00" } } }]
        : [{ text: "Não encontrei esse lugar." }],
    )
    return
  }
  if (fnResponse) {
    yield response([{ text: "Pronto! " }])
    yield response([{ text: "Deixei a proposta abaixo para você confirmar." }])
    return
  }
  if (/visitad/i.test(userText)) {
    yield response([{ functionCall: { name: "proposeMarkVisited", args: { placeRef: "P1", visited: true } } }])
    return
  }
  if (/adicion/i.test(userText)) {
    yield response([{ functionCall: { name: "searchPlaces", args: { query: "Pastéis de Belém, Lisboa" } } }])
    return
  }
  yield response([{ text: "Resposta de teste para: " }])
  yield response([{ text: userText.slice(0, 80) }])
}
