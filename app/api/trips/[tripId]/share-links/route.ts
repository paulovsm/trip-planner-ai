import { CreateShareLinkInput } from "@/lib/domain/schemas"
import { createShareLink, listShareLinks } from "@/lib/server/commands/share-links"
import { TripParams } from "@/lib/server/params"
import { json, withRoute } from "@/lib/server/route"

export const GET = withRoute({ auth: "user", params: TripParams }, ({ user, params }) =>
  listShareLinks(user, params.tripId),
)

export const POST = withRoute(
  { auth: "user", params: TripParams, body: CreateShareLinkInput },
  async ({ user, params, body }) => json(await createShareLink(user, params.tripId, body.expiresInDays), 201),
)
