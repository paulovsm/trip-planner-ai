import type { ProposalView } from "./proposals"
import type { Day, Place, Role, ShareLink, Stop, Trip, TravelMode } from "./schemas"

// Shapes returned by the API (shared by server and client).

export type TripSummary = Pick<Trip, "id" | "name" | "description" | "startDate" | "endDate" | "updatedAt"> & {
  role: Role
  placeCount: number
  memberCount: number
}

export type MemberView = { email: string; role: Role | "pending"; userId?: string }

export type TripDetail = {
  trip: Pick<Trip, "id" | "name" | "description" | "startDate" | "endDate" | "ownerId" | "updatedAt">
  role: Role
  members: MemberView[]
  places: Place[]
  days: Day[]
}

export type ShareLinkView = Pick<ShareLink, "id" | "createdAt" | "expiresAt" | "revokedAt"> & {
  status: "active" | "expired" | "revoked"
}

/** Returned once, at creation: the plain token is never stored or shown again. */
export type CreatedShareLink = ShareLinkView & { token: string; path: string }

/**
 * Public, read-only view behind a Share Link. Built from an explicit whitelist:
 * no ids, user ids, emails, owner identity or Stop notes.
 */
export type PublicTripDto = {
  name: string
  description?: string
  startDate?: string
  endDate?: string
  places: PublicPlace[]
  days: {
    date: string
    travelMode: TravelMode
    stops: (Pick<Stop, "time" | "durationMin"> & { place: PublicPlace })[]
  }[]
}

export type ChatMessageView = {
  id: string
  role: "user" | "model"
  text: string
  sources?: { title?: string; uri?: string }[]
  proposals?: ProposalView[]
  createdAt: string
}

export type PublicPlace = Pick<Place, "name" | "category" | "address" | "city" | "location" | "visited">
