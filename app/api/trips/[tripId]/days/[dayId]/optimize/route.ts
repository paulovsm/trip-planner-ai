import { z } from "zod"
import { optimizeDay } from "@/lib/server/commands/routes"
import { DayParams } from "@/lib/server/params"
import { withRoute } from "@/lib/server/route"

const OptimizeInput = z.object({ expectedVersion: z.number().int().nonnegative() })

/** Reorders the Stops for the shortest Route; returns { day, previousStopIds } for Undo. */
export const POST = withRoute(
  { auth: "user", params: DayParams, body: OptimizeInput, rateLimit: "maps-routes" },
  ({ user, params, body }) => optimizeDay(user, params.tripId, params.dayId, body.expectedVersion),
)
