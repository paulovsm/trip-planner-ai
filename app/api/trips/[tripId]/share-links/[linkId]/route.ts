import { revokeShareLink } from "@/lib/server/commands/share-links"
import { ShareLinkParams } from "@/lib/server/params"
import { withRoute } from "@/lib/server/route"

export const DELETE = withRoute({ auth: "user", params: ShareLinkParams }, ({ user, params }) =>
  revokeShareLink(user, params.tripId, params.linkId),
)
