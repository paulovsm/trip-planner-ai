import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { firestore } from "@/lib/server/firebase"

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ itineraryId: string; itemId: string }> }
) {
  const params = await props.params;
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url);
    const tripId = searchParams.get('tripId');

    if (!tripId) {
        return NextResponse.json({ error: "Trip ID is required" }, { status: 400 })
    }

    const itineraryRef = firestore.collection('trips').doc(tripId).collection('itineraries').doc(params.itineraryId);
    const doc = await itineraryRef.get();
    
    if (!doc.exists) {
        return NextResponse.json({ error: "Itinerary not found" }, { status: 404 })
    }
    
    const data = doc.data();
    const items = data?.items || [];
    const newItems = items.filter((item: any) => item.id !== params.itemId);

    await itineraryRef.update({ items: newItems });

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting item:", error)
    return NextResponse.json(
      { error: "Failed to delete item" },
      { status: 500 }
    )
  }
}
