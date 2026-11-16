/**
 * F1.8 risk test for the agentic chat (F4): measures gemini-4-argon latency with
 * function calling, checks whether Google Search grounding can be combined with
 * function declarations in one request, and whether a conversation that carries
 * Argon's thought signatures can continue on the Hydrogen fallback.
 *
 *   npm run ai:probe            # uses GEMINI_API_KEY from .env; sends only synthetic prompts
 */
import { GoogleGenAI, ThinkingLevel, type Content, type FunctionDeclaration } from "@google/genai"

try {
  process.loadEnvFile(".env")
} catch {
  // key may come from the shell
}
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
const PRIMARY = process.env.GEMINI_MODEL_CHAT || "gemini-4-argon"
const FALLBACK = process.env.GEMINI_MODEL_FALLBACK || "gemini-4-hydrogen"

const addStop: FunctionDeclaration = {
  name: "addStop",
  description: "Propõe adicionar um local a um dia do roteiro.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      placeName: { type: "string" },
      date: { type: "string", description: "AAAA-MM-DD" },
      time: { type: "string", description: "HH:mm" },
    },
    required: ["placeName", "date"],
  },
}

const PROMPT: Content = {
  role: "user",
  parts: [{ text: "Adicione a Torre de Belém no dia 2026-12-03 às 10:00." }],
}

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t = Date.now()
  const r = await fn()
  return [r, Date.now() - t]
}

const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))]

async function latency(runs = 5) {
  const times: number[] = []
  let calls = 0
  for (let i = 0; i < runs; i++) {
    const [res, ms] = await timed(() =>
      ai.models.generateContent({
        model: PRIMARY,
        contents: [PROMPT],
        config: { tools: [{ functionDeclarations: [addStop] }], thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
      }),
    )
    times.push(ms)
    if (res.functionCalls?.length) calls++
  }
  console.log(`1) ${PRIMARY} + function calling (LOW): p50=${pct(times, 50)}ms p95=${pct(times, 95)}ms, tool called in ${calls}/${runs}`)
}

async function searchPlusFunctions() {
  try {
    const [res, ms] = await timed(() =>
      ai.models.generateContent({
        model: PRIMARY,
        contents: [{ role: "user", parts: [{ text: "Qual o horário de funcionamento atual da Torre de Belém? Depois adicione-a em 2026-12-03." }] }],
        config: {
          tools: [{ googleSearch: {} }, { functionDeclarations: [addStop] }],
          toolConfig: { includeServerSideToolInvocations: true },
        },
      }),
    )
    const grounded = !!res.candidates?.[0]?.groundingMetadata?.groundingChunks?.length
    console.log(`2) googleSearch + functionDeclarations in one request: OK (${ms}ms, grounded=${grounded}, toolCalls=${res.functionCalls?.length ?? 0})`)
  } catch (err) {
    console.log(`2) googleSearch + functionDeclarations in one request: REJECTED → use a webSearch function (${(err as Error).message.slice(0, 160)})`)
  }
}

async function signatureFallback() {
  const first = await ai.models.generateContent({
    model: PRIMARY,
    contents: [PROMPT],
    config: { tools: [{ functionDeclarations: [addStop] }] },
  })
  const modelTurn = first.candidates?.[0]?.content
  const call = first.functionCalls?.[0]
  if (!modelTurn || !call) {
    console.log("3) no function call returned; cannot test signature round-trip")
    return
  }
  const hasSignature = modelTurn.parts?.some((p) => p.thoughtSignature)
  const history: Content[] = [
    PROMPT,
    modelTurn,
    { role: "user", parts: [{ functionResponse: { name: call.name!, response: { status: "proposed_to_user" } } }] },
  ]
  const mapParts = (fn: (p: NonNullable<Content["parts"]>[number]) => NonNullable<Content["parts"]>[number] | null) =>
    history.map((c) => ({ ...c, parts: c.parts?.filter((p) => !p.thought).map(fn).filter((p) => p !== null) }))
  const stripped = mapParts((p) => {
    const copy = { ...p }
    delete copy.thoughtSignature
    return copy
  })
  // Documented escape hatch for histories coming from another model.
  const dummySig = mapParts((p) => (p.functionCall ? { ...p, thoughtSignature: "skip_thought_signature_validator" } : p))
  // Last resort: flatten tool turns into plain text.
  const asText = mapParts((p) =>
    p.functionCall
      ? { text: `[assistente propôs ${p.functionCall.name}(${JSON.stringify(p.functionCall.args)})]` }
      : p.functionResponse
        ? { text: `[resultado de ${p.functionResponse.name}: ${JSON.stringify(p.functionResponse.response)}]` }
        : p,
  )
  for (const [label, model, contents] of [
    ["same model", PRIMARY, history],
    ["fallback, Argon signatures kept", FALLBACK, history],
    ["fallback, signatures stripped", FALLBACK, stripped],
    ["fallback, dummy signature", FALLBACK, dummySig],
    ["fallback, tool turns as text", FALLBACK, asText],
  ] as const) {
    try {
      const [res, ms] = await timed(() =>
        ai.models.generateContent({ model, contents: contents as Content[], config: { tools: [{ functionDeclarations: [addStop] }] } }),
      )
      console.log(`3) continue after tool call (${label}, ${model}): OK ${ms}ms → "${(res.text ?? "").slice(0, 60)}"`)
    } catch (err) {
      console.log(`3) continue after tool call (${label}, ${model}): FAILED (${(err as Error).message.slice(0, 160)})`)
    }
  }
  console.log(`   Argon returned thought signatures: ${hasSignature}`)
}

async function main() {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set")
  console.log(`Probing ${PRIMARY} (fallback ${FALLBACK})…`)
  await latency()
  await searchPlusFunctions()
  await signatureFallback()
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
