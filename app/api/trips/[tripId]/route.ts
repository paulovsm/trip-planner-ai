import { UpdateTripInput } from "@/lib/domain/schemas"
import { deleteTrip, getTripDetail, updateTrip } from "@/lib/server/commands/trips"
import { TripParams } from "@/lib/server/params"
import { withRoute } from "@/lib/server/route"

export const GET = withRoute({ auth: "user", params: TripParams }, ({ user, params }) =>
  getTripDetail(user, params.tripId),
)

export const PATCH = withRoute({ auth: "user", params: TripParams, body: UpdateTripInput }, ({ user, params, body }) =>
  updateTrip(user, params.tripId, body),
)

export const DELETE = withRoute({ auth: "user", params: TripParams }, ({ user, params }) =>
  deleteTrip(user, params.tripId),
)
