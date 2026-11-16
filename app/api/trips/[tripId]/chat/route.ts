import { z } from "zod"
import { clearChat, getChatHistory, startChatTurn } from "@/lib/server/commands/chat"
import { TripParams } from "@/lib/server/params"
import { withRoute } from "@/lib/server/route"

export const maxDuration = 120

const ChatInput = z.object({ message: z.string().trim().min(1).max(2000) })

export const GET = withRoute({ auth: "user", params: TripParams }, ({ user, params }) =>
  getChatHistory(user, params.tripId),
)

/** Streams the assistant turn as NDJSON events (text deltas, proposals, done/error). */
export const POST = withRoute(
  { auth: "user", params: TripParams, body: ChatInput, rateLimit: "ai-chat" },
  async ({ user, params, body, req }) => {
    const events = await startChatTurn(user, params.tripId, body.message, req.signal)
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { value, done } = await events.next()
        if (done) return controller.close()
        controller.enqueue(encoder.encode(JSON.stringify(value) + "\n"))
      },
      async cancel() {
        await events.return(undefined)
      },
    })
    return new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
    })
  },
)

export const DELETE = withRoute({ auth: "user", params: TripParams }, ({ user, params }) =>
  clearChat(user, params.tripId),
)
