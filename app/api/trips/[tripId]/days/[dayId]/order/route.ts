import { ReorderStopsInput } from "@/lib/domain/schemas"
import { reorderStops } from "@/lib/server/commands/days"
import { DayParams } from "@/lib/server/params"
import { withRoute } from "@/lib/server/route"

/** Whole-order replacement (Optimize/Undo). 409 when expectedVersion is stale. */
export const PUT = withRoute({ auth: "user", params: DayParams, body: ReorderStopsInput }, ({ user, params, body }) =>
  reorderStops(user, params.tripId, params.dayId, body.stopIds, body.expectedVersion),
)
