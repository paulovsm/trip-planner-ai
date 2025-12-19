import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { firestore } from "@/lib/firebase"
import { nanoid } from "nanoid"

export async function PUT(
  req: NextRequest,
  props: { params: Promise<{ itineraryId: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { items, tripId } = body

    if (!tripId) {
        return NextResponse.json({ error: "Trip ID is required" }, { status: 400 })
    }

    const itineraryRef = firestore.collection('trips').doc(tripId).collection('itineraries').doc(params.itineraryId);
    
    // Ensure we only store necessary fields and preserve ID
    const newItems = items.map((item: any) => ({
        id: item.id || nanoid(),
        pointId: item.pointId || item.point?.id, // Handle both structures if needed
        order: item.order
    }));

    await itineraryRef.update({ items: newItems });

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error reordering items:", error)
    return NextResponse.json(
      { error: "Failed to reorder items" },
      { status: 500 }
    )
  }
}
