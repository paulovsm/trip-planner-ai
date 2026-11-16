import { computeDayRoute } from "@/lib/server/commands/routes"
import { DayParams } from "@/lib/server/params"
import { withRoute } from "@/lib/server/route"

/** Computes and stores the Day's Route (Routes API, server-side key). */
export const POST = withRoute({ auth: "user", params: DayParams, rateLimit: "maps-routes" }, ({ user, params }) =>
  computeDayRoute(user, params.tripId, params.dayId),
)
