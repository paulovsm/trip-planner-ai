import { z } from "zod"
import { decideProposal } from "@/lib/server/commands/proposals"
import { TripParams } from "@/lib/server/params"
import { withRoute } from "@/lib/server/route"

const Params = TripParams.extend({ proposalId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/) })
const Decision = z.object({ decision: z.enum(["apply", "discard"]) })

/** Applies (runs the same commands as the UI) or discards an assistant Proposal. */
export const POST = withRoute(
  { auth: "user", params: Params, body: Decision, rateLimit: "ai-proposal-apply" },
  ({ user, params, body }) => decideProposal(user, params.tripId, params.proposalId, body.decision),
)
