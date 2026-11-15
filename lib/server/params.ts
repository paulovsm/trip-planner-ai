import { z } from "zod"

// Route param schemas (Firestore auto-ids / nanoid / sha256 — never paths).
const Id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, "Identificador inválido")

export const TripParams = z.object({ tripId: Id })
export const PlaceParams = TripParams.extend({ placeId: Id })
export const DayParams = TripParams.extend({ dayId: Id })
export const StopParams = DayParams.extend({ stopId: Id })
export const ShareLinkParams = TripParams.extend({ linkId: z.string().regex(/^[a-f0-9]{64}$/) })
export const MemberParams = TripParams.extend({ email: z.string().min(3).max(320) })
