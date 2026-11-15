import { UpdateStopInput } from "@/lib/domain/schemas"
import { editStop, removeStopFromDay } from "@/lib/server/commands/days"
import { StopParams } from "@/lib/server/params"
import { withRoute } from "@/lib/server/route"

/** Edits time/duration/notes and/or moves the Stop (toIndex, toDayId). Returns affected Days. */
export const PATCH = withRoute({ auth: "user", params: StopParams, body: UpdateStopInput }, ({ user, params, body }) =>
  editStop(user, params.tripId, params.dayId, params.stopId, body),
)

export const DELETE = withRoute({ auth: "user", params: StopParams }, ({ user, params }) =>
  removeStopFromDay(user, params.tripId, params.dayId, params.stopId),
)
