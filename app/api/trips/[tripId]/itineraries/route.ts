import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { firestore } from "@/lib/server/firebase"

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ tripId: string }> }
) {
  const params = await props.params;
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { date } = body

    const tripRef = firestore.collection('trips').doc(params.tripId);
    const tripDoc = await tripRef.get();

    if (!tripDoc.exists) {
        return NextResponse.json({ error: "Trip not found" }, { status: 404 })
    }

    const itineraryRef = tripRef.collection('itineraries').doc();
    const itineraryId = itineraryRef.id;
    
    const itineraryData = {
        id: itineraryId,
        date: new Date(date),
        tripId: params.tripId,
        items: []
    };

    await itineraryRef.set(itineraryData);

    return NextResponse.json({
        ...itineraryData,
        date: itineraryData.date
    })
  } catch (error) {
    console.error("Error creating itinerary:", error)
    return NextResponse.json(
      { error: "Failed to create itinerary" },
      { status: 500 }
    )
  }
}
