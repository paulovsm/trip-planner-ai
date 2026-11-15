import { CreatePlaceInput } from "@/lib/domain/schemas"
import { createPlace } from "@/lib/server/commands/places"
import { TripParams } from "@/lib/server/params"
import { json, withRoute } from "@/lib/server/route"

export const POST = withRoute(
  { auth: "user", params: TripParams, body: CreatePlaceInput },
  async ({ user, params, body }) => json(await createPlace(user, params.tripId, body), 201),
)
