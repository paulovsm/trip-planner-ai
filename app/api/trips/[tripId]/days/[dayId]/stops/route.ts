import { AddStopInput } from "@/lib/domain/schemas"
import { addStop } from "@/lib/server/commands/days"
import { DayParams } from "@/lib/server/params"
import { json, withRoute } from "@/lib/server/route"

export const POST = withRoute(
  { auth: "user", params: DayParams, body: AddStopInput },
  async ({ user, params, body }) => json(await addStop(user, params.tripId, params.dayId, body), 201),
)
