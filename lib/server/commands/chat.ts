import "server-only"
import type { Content, Part } from "@google/genai"
import { generateStream } from "@/lib/ai/client"
import { chatSystemInstruction, placeRefs } from "@/lib/ai/prompts"
import { functionDeclarations, isToolName, READ_TOOLS, TOOL_ARGS } from "@/lib/ai/tools"
import type { ChatMessageView } from "@/lib/domain/dto"
import { DomainError } from "@/lib/domain/errors"
import { ProposalArgError, resolveAction, summarize, type ProposalPlace, type ProposalView } from "@/lib/domain/proposals"
import { tripRef, type SessionUser } from "../authz"
import { firestore } from "../firebase"
import { nowIso } from "../firestore-io"
import { searchText } from "../maps/places-api"
import { listProposals, storeProposal } from "./proposals"
import { getTripDetail } from "./trips"

// Agentic chat (F4). History is persisted per user per Trip and loaded on the server;
// the client only sends the new message. Tool turns are stored (hidden) so thought
// signatures survive across turns.

const HISTORY_LIMIT = 60
const MAX_TOOL_ROUNDS = 5

export type ChatEvent =
  | { type: "status"; text: string }
  | { type: "text"; delta: string }
  | { type: "proposal"; proposal: ProposalView }
  | { type: "done"; message: ChatMessageView }
  | { type: "error"; message: string }

type MessageDoc = {
  role: "user" | "model"
  content: Content
  hidden?: boolean
  display?: { text: string; sources?: { title?: string; uri?: string }[]; proposalIds?: string[] }
  model?: string
  createdAt: string
}

const messagesOf = (tripId: string, userId: string) => tripRef(tripId).collection("chats").doc(userId).collection("messages")

/** Firestore rejects some nested values from the SDK (e.g. class instances); store plain JSON. */
const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v))

async function loadHistory(tripId: string, userId: string) {
  const snap = await messagesOf(tripId, userId).orderBy("createdAt").limitToLast(HISTORY_LIMIT).get()
  const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as MessageDoc) }))
  // Never start the model history mid tool-sequence (truncation could cut a functionCall/response pair).
  const start = docs.findIndex((d) => d.role === "user" && !d.hidden)
  return start === -1 ? [] : docs.slice(start)
}

export async function getChatHistory(user: SessionUser, tripId: string): Promise<ChatMessageView[]> {
  await getTripDetail(user, tripId) // access check
  const [docs, proposals] = await Promise.all([loadHistory(tripId, user.id), listProposals(user, tripId)])
  return docs
    .filter((d) => !d.hidden && d.display)
    .map((d) => ({
      id: d.id,
      role: d.role,
      text: d.display!.text,
      sources: d.display!.sources,
      proposals: d.display!.proposalIds?.flatMap((id) => (proposals.has(id) ? [proposals.get(id)!] : [])),
      createdAt: d.createdAt,
    }))
}

export async function clearChat(user: SessionUser, tripId: string): Promise<void> {
  await getTripDetail(user, tripId)
  await firestore.recursiveDelete(tripRef(tripId).collection("chats").doc(user.id))
}

/**
 * Starts an assistant turn. Access checks and context loading happen before the
 * returned stream starts, so errors surface as normal HTTP errors.
 */
export async function startChatTurn(
  user: SessionUser,
  tripId: string,
  message: string,
  signal?: AbortSignal,
): Promise<AsyncGenerator<ChatEvent>> {
  const detail = await getTripDetail(user, tripId)
  const history = await loadHistory(tripId, user.id)
  const col = messagesOf(tripId, user.id)
  const finalRef = col.doc()

  // Resolution context for proposals.
  const refToId = new Map([...placeRefs(detail)].map(([id, ref]) => [ref, id]))
  const placeNames = new Map(detail.places.map((p) => [p.id, p.name]))
  const existingByGoogleId = new Map(detail.places.flatMap((p) => (p.googlePlaceId ? [[p.googlePlaceId, p.id] as const] : [])))
  const searchResults = new Map<string, ProposalPlace>()
  const bias = detail.places[0]?.location

  const userTurn: Content = { role: "user", parts: [{ text: message }] }
  const contents: Content[] = [...history.map((h) => h.content), userTurn]
  const toPersist: MessageDoc[] = [{ role: "user", content: userTurn, display: { text: message }, createdAt: nowIso() }]
  const proposals: ProposalView[] = []

  async function runTool(name: string | undefined, args: Record<string, unknown> | undefined): Promise<Record<string, unknown>> {
    if (!isToolName(name)) return { error: `Ferramenta desconhecida: ${name}` }
    const parsed = TOOL_ARGS[name].safeParse(args ?? {})
    if (!parsed.success) return { error: `Argumentos inválidos: ${parsed.error.issues.map((i) => i.message).join("; ")}` }

    if (READ_TOOLS.has(name)) {
      try {
        const results = await searchText((parsed.data as { query: string }).query, { bias, max: 5 })
        results.forEach((r) => searchResults.set(r.googlePlaceId, r))
        return {
          results: results.map((r) => ({ googlePlaceId: r.googlePlaceId, name: r.name, address: r.address, city: r.city, category: r.category, rating: r.rating })),
        }
      } catch (err) {
        return { error: err instanceof DomainError ? err.message : "Busca indisponível." }
      }
    }

    try {
      const action = resolveAction(name, parsed.data as Record<string, unknown>, { refs: refToId, placeNames, searchResults, existingByGoogleId })
      const proposal = await storeProposal(user, tripId, finalRef.id, action, summarize(action, placeNames))
      proposals.push(proposal)
      return { status: "proposta_criada_aguardando_confirmacao_do_usuario", resumo: proposal.summary }
    } catch (err) {
      if (err instanceof ProposalArgError) return { error: err.message }
      throw err
    }
  }

  async function* events(): AsyncGenerator<ChatEvent> {
    let finalText = ""
    let sources: { title?: string; uri?: string }[] = []
    let model = ""
    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const result = await generateStream(
          "agent",
          contents,
          {
            systemInstruction: chatSystemInstruction(detail),
            tools: [{ googleSearch: {} }, { functionDeclarations }],
            toolConfig: { includeServerSideToolInvocations: true },
          },
          signal,
        )
        model = result.model
        const parts: Part[] = []
        let roundText = ""
        for await (const chunk of result.stream) {
          const candidate = chunk.candidates?.[0]
          for (const part of candidate?.content?.parts ?? []) {
            parts.push(part)
            if (part.text && !part.thought) {
              roundText += part.text
              yield { type: "text", delta: part.text }
            }
          }
          const chunks = candidate?.groundingMetadata?.groundingChunks ?? []
          for (const c of chunks) if (c.web?.uri) sources.push({ title: c.web.title, uri: c.web.uri })
        }
        const modelTurn: Content = { role: "model", parts }
        contents.push(modelTurn)
        const calls = parts.filter((p) => p.functionCall)
        if (calls.length === 0) {
          finalText = roundText
          toPersist.push({ role: "model", content: modelTurn, model, createdAt: nowIso() })
          break
        }
        toPersist.push({ role: "model", content: modelTurn, hidden: true, model, createdAt: nowIso() })
        const responses: Part[] = []
        for (const { functionCall } of calls) {
          if (functionCall!.name === "searchPlaces") yield { type: "status", text: "Buscando lugares no Google…" }
          const before = proposals.length
          const response = await runTool(functionCall!.name, functionCall!.args)
          if (proposals.length > before) yield { type: "proposal", proposal: proposals.at(-1)! }
          responses.push({ functionResponse: { id: functionCall!.id, name: functionCall!.name, response } })
        }
        const toolTurn: Content = { role: "user", parts: responses }
        contents.push(toolTurn)
        toPersist.push({ role: "user", content: toolTurn, hidden: true, createdAt: nowIso() })
      }
      if (!finalText) finalText = proposals.length ? "Preparei as propostas abaixo — confirme as que quiser aplicar." : "Não consegui concluir agora. Tente reformular."
    } catch (err) {
      if (signal?.aborted) return
      console.error("[chat] turn failed", err)
      yield { type: "error", message: "O assistente não respondeu. Tente novamente." }
      return
    }

    sources = sources.filter((s, i, a) => a.findIndex((x) => x.uri === s.uri) === i).slice(0, 8)
    // The last persisted model turn becomes the visible answer.
    const last = toPersist.at(-1)!
    if (last.role !== "model" || last.hidden) {
      toPersist.push({ role: "model", content: { role: "model", parts: [{ text: finalText }] }, model, createdAt: nowIso() })
    }
    const answer = toPersist.at(-1)!
    answer.display = { text: finalText, sources: sources.length ? sources : undefined, proposalIds: proposals.map((p) => p.id) }

    // Strictly increasing timestamps keep the stored order.
    const base = Date.now()
    const batch = firestore.batch()
    toPersist.forEach((m, i) => {
      const ref = m === answer ? finalRef : col.doc()
      batch.set(ref, plain({ ...m, createdAt: new Date(base + i).toISOString() }))
    })
    batch.set(col.parent!, { updatedAt: nowIso() }, { merge: true })
    await batch.commit()

    yield {
      type: "done",
      message: {
        id: finalRef.id,
        role: "model",
        text: finalText,
        sources: answer.display.sources,
        proposals,
        createdAt: new Date(base + toPersist.length - 1).toISOString(),
      },
    }
  }

  return events()
}
