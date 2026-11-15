import { CreateTripInput } from "@/lib/domain/schemas"
import { createTrip, listTrips } from "@/lib/server/commands/trips"
import { json, withRoute } from "@/lib/server/route"

export const GET = withRoute({ auth: "user" }, ({ user }) => listTrips(user))

export const POST = withRoute({ auth: "user", body: CreateTripInput }, async ({ user, body }) =>
  json(await createTrip(user, body), 201),
)
