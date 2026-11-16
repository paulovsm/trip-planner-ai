import { Suspense } from "react"
import { TripShell } from "@/components/trip/trip-shell"

export default async function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params
  return (
    <Suspense>
      <TripShell tripId={tripId} />
    </Suspense>
  )
}
