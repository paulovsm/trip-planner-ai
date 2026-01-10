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

    // Remove point from any itineraries
    const itinerariesSnapshot = await tripRef.collection('itineraries').get();
    const batch = firestore.batch();
    let hasUpdates = false;

    itinerariesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.items && Array.isArray(data.items)) {
        const newItems = data.items.filter((item: any) => item.pointId !== params.pointId);
        if (newItems.length !== data.items.length) {
          batch.update(doc.ref, { items: newItems });
          hasUpdates = true;
        }
      }
    });

    if (hasUpdates) {
      await batch.commit();
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

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ tripId: string; pointId: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json();
    const { visited, address, latitude, longitude, name, description, category, city } = body;

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

    // Build update object with only provided fields
    const updateData: Record<string, string | number | boolean | Date | null> = { updatedAt: new Date() };
    if (visited !== undefined) updateData.visited = visited;
    if (address !== undefined) updateData.address = address;
    if (latitude !== undefined) updateData.latitude = latitude;
    if (longitude !== undefined) updateData.longitude = longitude;
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (city !== undefined) updateData.city = city;

    await pointRef.update(updateData);

    return NextResponse.json({ success: true, ...updateData })
  } catch (error) {
    console.error("Error updating point:", error)
    return NextResponse.json(
      { error: "Failed to update point" },
      { status: 500 }
    )
  }
}
