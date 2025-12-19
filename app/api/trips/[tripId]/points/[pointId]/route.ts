import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { firestore } from "@/lib/firebase"

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ tripId: string; pointId: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tripRef = firestore.collection('trips').doc(params.tripId);
    const tripDoc = await tripRef.get();

    if (!tripDoc.exists) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 })
    }

    const tripData = tripDoc.data();

    // Check ownership
    const usersRef = firestore.collection('users');
    const userSnapshot = await usersRef.where('email', '==', session.user.email).limit(1).get();
    
    if (userSnapshot.empty || tripData?.userId !== userSnapshot.docs[0].id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const pointRef = tripRef.collection('points').doc(params.pointId);
    const pointDoc = await pointRef.get();

    if (!pointDoc.exists) {
      return NextResponse.json({ error: "Point not found" }, { status: 404 })
    }

    await pointRef.delete();

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting point:", error)
    return NextResponse.json(
      { error: "Failed to delete point" },
      { status: 500 }
    )
  }
}
