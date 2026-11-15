import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { cache } from "react"
import { DomainError } from "@/lib/domain/errors"
import { getPublicTrip } from "@/lib/server/commands/share-links"
import { clientIp, enforceRateLimit, hashIp } from "@/lib/server/rate-limit"
import { SharedTripView } from "./shared-trip-view"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ token: string }> }

// One rate-limited lookup per request, shared by generateMetadata and the page.
const loadTrip = cache(async (token: string) => {
  await enforceRateLimit("share-public", hashIp(clientIp(await headers())))
  return getPublicTrip(token)
})

async function load(token: string) {
  try {
    return { trip: await loadTrip(token) }
  } catch (err) {
    if (err instanceof DomainError && err.code === "NOT_FOUND") notFound()
    if (err instanceof DomainError && err.code === "RATE_LIMITED") return { error: err.message }
    throw err
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const { trip } = await load(token)
  return {
    title: trip ? `${trip.name} · TripPlanner` : "TripPlanner",
    description: trip ? `Roteiro com ${trip.places.length} lugares e ${trip.days.length} dias.` : undefined,
    robots: { index: false, follow: false },
    openGraph: trip ? { title: trip.name, type: "website" } : undefined,
  }
}

export default async function SharedTripPage({ params }: Props) {
  const { token } = await params
  const { trip, error } = await load(token)
  if (!trip) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6 text-center">
        <p className="text-lg font-medium">{error}</p>
      </div>
    )
  }
  return <SharedTripView trip={trip} />
}
