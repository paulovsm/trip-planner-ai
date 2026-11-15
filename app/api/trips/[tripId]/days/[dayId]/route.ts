import { UpdateDayInput } from "@/lib/domain/schemas"
import { deleteDay, updateDay } from "@/lib/server/commands/days"
import { DayParams } from "@/lib/server/params"
import { withRoute } from "@/lib/server/route"

export const PATCH = withRoute({ auth: "user", params: DayParams, body: UpdateDayInput }, ({ user, params, body }) =>
  updateDay(user, params.tripId, params.dayId, body),
)

export const DELETE = withRoute({ auth: "user", params: DayParams }, ({ user, params }) =>
  deleteDay(user, params.tripId, params.dayId),
)
