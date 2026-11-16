import { z } from "zod"
import { exportRoute } from "@/lib/server/commands/routes"
import { DayParams } from "@/lib/server/params"
import { withRoute } from "@/lib/server/route"

const ExportInput = z.object({ mode: z.enum(["WALK", "BICYCLE"]) })

/** Walking/cycling Route for GPX export of a car/transit Day; not stored. */
export const POST = withRoute(
  { auth: "user", params: DayParams, body: ExportInput, rateLimit: "maps-routes" },
  ({ user, params, body }) => exportRoute(user, params.tripId, params.dayId, body.mode),
)
