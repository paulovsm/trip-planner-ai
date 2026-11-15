import "server-only"
import type { Content } from "@google/genai"
import { generate } from "@/lib/ai/client"
import { chatSystemInstruction } from "@/lib/ai/prompts"
import type { ChatMessageView } from "@/lib/domain/dto"
import { tripRef, type SessionUser } from "../authz"
import { firestore } from "../firebase"
import { nowIso } from "../firestore-io"
import { getTripDetail } from "./trips"

// Chat history is persisted per user per Trip (decision Q20) and loaded on the
// server; the client only ever sends the new message (no forged history).

const HISTORY_LIMIT = 40

const messagesOf = (tripId: string, userId: string) =>
  tripRef(tripId).collection("chats").doc(userId).collection("messages")

/** Firestore rejects undefined values nested in the raw Gemini content. */
const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v))

export async function getChatHistory(user: SessionUser, tripId: string): Promise<ChatMessageView[]> {
  await getTripDetail(user, tripId) // access check
  const snap = await messagesOf(tripId, user.id).orderBy("createdAt").limitToLast(HISTORY_LIMIT).get()
  return snap.docs.map((d) => ({
    id: d.id,
    role: d.get("role"),
    text: d.get("display.text"),
    sources: d.get("display.sources") ?? undefined,
    createdAt: d.get("createdAt"),
  }))
}

export async function sendChatMessage(user: SessionUser, tripId: string, message: string): Promise<ChatMessageView> {
  const detail = await getTripDetail(user, tripId) // access check + fresh trip context
  const col = messagesOf(tripId, user.id)
  const history = await col.orderBy("createdAt").limitToLast(HISTORY_LIMIT).get()
  const contents: Content[] = [
    ...history.docs.map((d) => d.get("content") as Content),
    { role: "user", parts: [{ text: message }] },
  ]

  const result = await generate("chat", contents, {
    systemInstruction: chatSystemInstruction(detail),
    tools: [{ googleSearch: {} }],
  })

  const userAt = nowIso()
  const modelAt = new Date(Date.parse(userAt) + 1).toISOString()
  const batch = firestore.batch()
  batch.set(col.doc(), {
    role: "user",
    content: { role: "user", parts: [{ text: message }] },
    display: { text: message },
    createdAt: userAt,
  })
  const modelRef = col.doc()
  batch.set(
    modelRef,
    plain({
      role: "model",
      content: result.content,
      display: { text: result.text, sources: result.grounding },
      model: result.model,
      createdAt: modelAt,
    }),
  )
  batch.set(col.parent!, { updatedAt: modelAt }, { merge: true })
  await batch.commit()

  return { id: modelRef.id, role: "model", text: result.text, sources: result.grounding, createdAt: modelAt }
}

export async function clearChat(user: SessionUser, tripId: string): Promise<void> {
  await getTripDetail(user, tripId)
  await firestore.recursiveDelete(tripRef(tripId).collection("chats").doc(user.id))
}
