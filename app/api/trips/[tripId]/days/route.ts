import { CreateDayInput } from "@/lib/domain/schemas"
import { createDay } from "@/lib/server/commands/days"
import { TripParams } from "@/lib/server/params"
import { json, withRoute } from "@/lib/server/route"

export const POST = withRoute(
  { auth: "user", params: TripParams, body: CreateDayInput },
  async ({ user, params, body }) => json(await createDay(user, params.tripId, body), 201),
)
