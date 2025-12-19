import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { firestore } from "@/lib/firebase"

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ tripId: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { name, description, category, address, city, latitude, longitude } = body

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
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

    const pointRef = tripRef.collection('points').doc();
    const now = new Date();
    
    const newPoint = {
      id: pointRef.id,
      name,
      description: description || null,
      category: category || null,
      address: address || null,
      city: city || null,
      latitude: latitude || 0,
      longitude: longitude || 0,
      createdAt: now,
      updatedAt: now,
      tripId: params.tripId
    };

    await pointRef.set(newPoint);

    return NextResponse.json({
        ...newPoint,
        createdAt: now,
        updatedAt: now
    })
  } catch (error) {
    console.error("Error creating point:", error)
    return NextResponse.json(
      { error: "Failed to create point" },
      { status: 500 }
    )
  }
}
