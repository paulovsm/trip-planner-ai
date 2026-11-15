import { UpdatePlaceInput } from "@/lib/domain/schemas"
import { deletePlace, updatePlace } from "@/lib/server/commands/places"
import { PlaceParams } from "@/lib/server/params"
import { withRoute } from "@/lib/server/route"

export const PATCH = withRoute({ auth: "user", params: PlaceParams, body: UpdatePlaceInput }, ({ user, params, body }) =>
  updatePlace(user, params.tripId, params.placeId, body),
)

export const DELETE = withRoute({ auth: "user", params: PlaceParams }, ({ user, params }) =>
  deletePlace(user, params.tripId, params.placeId),
)
