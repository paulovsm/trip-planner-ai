import { z } from "zod"
import { clearChat, getChatHistory, sendChatMessage } from "@/lib/server/commands/chat"
import { TripParams } from "@/lib/server/params"
import { withRoute } from "@/lib/server/route"

export const maxDuration = 60

const ChatInput = z.object({ message: z.string().trim().min(1).max(2000) })

export const GET = withRoute({ auth: "user", params: TripParams }, ({ user, params }) =>
  getChatHistory(user, params.tripId),
)

export const POST = withRoute(
  { auth: "user", params: TripParams, body: ChatInput, rateLimit: "ai-chat" },
  ({ user, params, body }) => sendChatMessage(user, params.tripId, body.message),
)

export const DELETE = withRoute({ auth: "user", params: TripParams }, ({ user, params }) =>
  clearChat(user, params.tripId),
)
