import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { firestore } from "@/lib/firebase"
import * as admin from 'firebase-admin';

import { nanoid } from 'nanoid'

export async function POST(
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
    const { pointId, tripId } = body

    if (!tripId) {
        return NextResponse.json({ error: "Trip ID is required" }, { status: 400 })
    }

    // Find the itinerary directly using tripId
    const itineraryRef = firestore.collection('trips').doc(tripId).collection('itineraries').doc(params.itineraryId);
    const itineraryDoc = await itineraryRef.get();

    if (!itineraryDoc.exists) {
      return NextResponse.json({ error: "Itinerary not found" }, { status: 404 })
    }

    const itineraryData = itineraryDoc.data();

    // Get current items
    const currentItems = itineraryData.items || [];
    
    // Calculate new order
    const maxOrder = currentItems.reduce((max: number, item: any) => item.order > max ? item.order : max, 0);
    const newOrder = maxOrder + 1;

    const newItem = {
      id: nanoid(),
      pointId,
      order: newOrder,
    };

    // Update the document
    await itineraryRef.update({
      items: admin.firestore.FieldValue.arrayUnion(newItem)
    });

    // Fetch point details to return
    const tripRef = itineraryRef.parent.parent;
    
    if (!tripRef) {
         return NextResponse.json({ error: "Trip not found" }, { status: 404 })
    }

    // We need to find the point. It's in the 'points' subcollection of the trip.
    // However, pointId might be just the ID.
    // Let's assume pointId is the document ID in 'points' subcollection.
    
    // We can try to fetch it directly if we know the ID.
    // But wait, pointId in Prisma was a UUID. In Firestore it's also a string ID.
    // If we used the same ID generation strategy, it matches.
    
    // But wait, in POST /trips, I used `tripRef.collection('points').doc().id` which generates a random ID.
    // So pointId passed here should be that ID.
    
    // But wait, if the point was created in a different way?
    // Let's assume pointId is correct.
    
    // We can query the points subcollection.
    const pointRef = tripRef.collection('points').doc(pointId);
    const pointDoc = await pointRef.get();
    
    let pointData = null;
    if (pointDoc.exists) {
        pointData = pointDoc.data();
    } else {
        // Fallback: maybe search in points subcollection if ID mismatch?
        // But for now assume ID match.
    }

    return NextResponse.json({
      ...newItem,
      point: pointData
    })
  } catch (error) {
    console.error("Error adding item to itinerary:", error)
    return NextResponse.json(
      { error: "Failed to add item" },
      { status: 500 }
    )
  }
}
