import { InviteMemberInput } from "@/lib/domain/schemas"
import { inviteMember } from "@/lib/server/commands/members"
import { TripParams } from "@/lib/server/params"
import { withRoute } from "@/lib/server/route"

export const POST = withRoute({ auth: "user", params: TripParams, body: InviteMemberInput }, ({ user, params, body }) =>
  inviteMember(user, params.tripId, body.email),
)
