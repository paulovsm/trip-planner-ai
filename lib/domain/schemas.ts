import { z } from "zod"
import { PLACE_CATEGORIES } from "./categories"

// Single source of truth for the domain model (see GLOSSARY.md).
// Types are inferred from these schemas; timestamps travel as ISO-8601 strings.

export const MAX_STOPS_PER_DAY = 50

const isRealDate = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/** Calendar date without time zone, e.g. "2026-12-03". */
export const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato AAAA-MM-DD")
  .refine(isRealDate, "Data inválida")

/** Local wall-clock time, e.g. "09:30". */
export const TimeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário deve estar no formato HH:mm")

export const Timestamp = z.iso.datetime({ offset: true })

export const Email = z.string().trim().toLowerCase().pipe(z.email("Email inválido"))

export const LatLng = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .refine((p) => !(p.lat === 0 && p.lng === 0), "Localização inválida")

export const PlaceCategory = z.enum(PLACE_CATEGORIES)
export const TravelMode = z.enum(["WALK", "BICYCLE", "DRIVE", "TRANSIT"])
export const Role = z.enum(["owner", "editor"])
export const PlaceSource = z.enum(["manual", "import", "ai"])

const Id = z.string().min(1).max(128)
const Name = (max: number) => z.string().trim().min(1, "Obrigatório").max(max)
const OptionalText = (max: number) => z.string().trim().max(max).optional()

// ---------- Entities ----------

export const Member = z.object({
  email: Email,
  role: Role,
  joinedAt: Timestamp,
})

export const Trip = z.object({
  id: Id,
  name: Name(120),
  description: OptionalText(2000),
  startDate: IsoDate.optional(),
  endDate: IsoDate.optional(),
  ownerId: Id,
  members: z.record(Id, Member),
  memberIds: z.array(Id),
  memberEmails: z.array(Email),
  pendingEmails: z.array(Email),
  schemaVersion: z.literal(2),
  createdAt: Timestamp,
  updatedAt: Timestamp,
})

export const Place = z.object({
  id: Id,
  name: Name(200),
  category: PlaceCategory,
  description: OptionalText(2000),
  address: OptionalText(300),
  city: OptionalText(120),
  location: LatLng,
  googlePlaceId: z.string().max(256).optional(),
  visited: z.boolean(),
  visitedAt: Timestamp.optional(),
  visitedBy: Id.optional(),
  source: PlaceSource,
  createdBy: Id,
  createdAt: Timestamp,
  updatedAt: Timestamp,
})

export const Stop = z.object({
  id: Id,
  placeId: Id,
  time: TimeOfDay.optional(),
  durationMin: z.number().int().min(0).max(24 * 60).optional(),
  notes: OptionalText(1000),
})

export const RouteLeg = z.object({
  distanceMeters: z.number().nonnegative(),
  durationSec: z.number().nonnegative(),
})

export const Route = z.object({
  travelMode: TravelMode,
  /** Stop ids joined with "," at computation time; used to detect a stale Route. */
  stopIdsKey: z.string(),
  encodedPolyline: z.string().max(300_000),
  distanceMeters: z.number().nonnegative(),
  durationSec: z.number().nonnegative(),
  legs: z.array(RouteLeg),
  computedAt: Timestamp,
  warnings: z.array(z.string()).optional(),
})

export const Day = z.object({
  id: Id,
  date: IsoDate,
  travelMode: TravelMode,
  stops: z.array(Stop).max(MAX_STOPS_PER_DAY),
  version: z.number().int().nonnegative(),
  route: Route.nullable(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
  updatedBy: Id,
})

export const ShareLink = z.object({
  id: z.string().length(64), // sha256(token) in hex; the token itself is never stored
  tripId: Id,
  createdBy: Id,
  createdAt: Timestamp,
  expiresAt: Timestamp,
  revokedAt: Timestamp.nullable(),
})

export type Member = z.infer<typeof Member>
export type Trip = z.infer<typeof Trip>
export type Place = z.infer<typeof Place>
export type Stop = z.infer<typeof Stop>
export type Route = z.infer<typeof Route>
export type Day = z.infer<typeof Day>
export type ShareLink = z.infer<typeof ShareLink>
export type TravelMode = z.infer<typeof TravelMode>
export type Role = z.infer<typeof Role>

// ---------- API inputs ----------

const dateRangeOk = (v: { startDate?: string; endDate?: string }) =>
  !v.startDate || !v.endDate || v.startDate <= v.endDate

export const CreateTripInput = z
  .object({
    name: Name(120),
    description: OptionalText(2000),
    startDate: IsoDate.optional(),
    endDate: IsoDate.optional(),
  })
  .refine(dateRangeOk, { message: "A data final deve ser igual ou posterior à inicial", path: ["endDate"] })

export const UpdateTripInput = z
  .object({
    name: Name(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    startDate: IsoDate.nullable().optional(),
    endDate: IsoDate.nullable().optional(),
  })
  .refine((v) => dateRangeOk({ startDate: v.startDate ?? undefined, endDate: v.endDate ?? undefined }), {
    message: "A data final deve ser igual ou posterior à inicial",
    path: ["endDate"],
  })

export const CreatePlaceInput = z.object({
  name: Name(200),
  category: PlaceCategory,
  description: OptionalText(2000),
  address: OptionalText(300),
  city: OptionalText(120),
  location: LatLng,
  googlePlaceId: z.string().max(256).optional(),
})

export const UpdatePlaceInput = CreatePlaceInput.partial().extend({
  /** Absolute value (idempotent, safe to replay from the offline queue). */
  visited: z.boolean().optional(),
})

export const CreateDayInput = z.object({
  date: IsoDate,
  travelMode: TravelMode.optional(),
})

export const UpdateDayInput = z.object({
  date: IsoDate.optional(),
  travelMode: TravelMode.optional(),
})

export const AddStopInput = z.object({
  placeId: Id,
  index: z.number().int().nonnegative().optional(),
})

export const UpdateStopInput = z.object({
  time: TimeOfDay.nullable().optional(),
  durationMin: z.number().int().min(0).max(24 * 60).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  toIndex: z.number().int().nonnegative().optional(),
  toDayId: Id.optional(),
})

export const ReorderStopsInput = z.object({
  stopIds: z.array(Id).max(MAX_STOPS_PER_DAY),
  expectedVersion: z.number().int().nonnegative(),
})

export const InviteMemberInput = z.object({ email: Email })

export const CreateShareLinkInput = z.object({
  expiresInDays: z.number().int().min(1).max(365).default(30),
})

export type CreateTripInput = z.infer<typeof CreateTripInput>
export type UpdateTripInput = z.infer<typeof UpdateTripInput>
export type CreatePlaceInput = z.infer<typeof CreatePlaceInput>
export type UpdatePlaceInput = z.infer<typeof UpdatePlaceInput>
export type CreateDayInput = z.infer<typeof CreateDayInput>
export type UpdateDayInput = z.infer<typeof UpdateDayInput>
export type AddStopInput = z.infer<typeof AddStopInput>
export type UpdateStopInput = z.infer<typeof UpdateStopInput>
export type ReorderStopsInput = z.infer<typeof ReorderStopsInput>
