import { removeMember } from "@/lib/server/commands/members"
import { MemberParams } from "@/lib/server/params"
import { withRoute } from "@/lib/server/route"

export const DELETE = withRoute({ auth: "user", params: MemberParams }, ({ user, params }) =>
  removeMember(user, params.tripId, decodeURIComponent(params.email)),
)
