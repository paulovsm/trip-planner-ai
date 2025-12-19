import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  const params = await props.params;
  try {
    const linksRef = firestore.collection('sharedLinks');
    const snapshot = await linksRef.where('token', '==', params.token).limit(1).get();

    if (snapshot.empty) {
      return NextResponse.json({ error: "Link not found or expired" }, { status: 404 });
    }

    const linkDoc = snapshot.docs[0];
    const linkData = linkDoc.data();

    if (!linkData.isActive) {
      return NextResponse.json({ error: "Link not found or expired" }, { status: 404 });
    }

    if (linkData.expiresAt && new Date() > linkData.expiresAt.toDate()) {
      return NextResponse.json({ error: "Link expired" }, { status: 410 });
    }

    // Fetch trip details
    const tripRef = firestore.collection('trips').doc(linkData.tripId);
    const tripDoc = await tripRef.get();

    if (!tripDoc.exists) {
        return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const tripData = tripDoc.data();

    // Fetch user details
    const userRef = firestore.collection('users').doc(tripData?.userId);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : null;

    // Fetch points
    const pointsSnapshot = await tripRef.collection('points').get();
    const points = pointsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt.toDate(),
            updatedAt: data.updatedAt.toDate()
        }
    });

    // Fetch itineraries
    const itinerariesSnapshot = await tripRef.collection('itineraries').orderBy('date', 'asc').get();
    const itineraries = await Promise.all(itinerariesSnapshot.docs.map(async doc => {
      const data = doc.data();
      let items = data.items || [];
      
      // Populate point details
      items = await Promise.all(items.map(async (item: any) => {
        if (item.pointId) {
            const point = points.find(p => p.id === item.pointId);
            return { ...item, point };
        }
        return item;
      }));

      return {
        ...data,
        date: data.date.toDate(),
        items
      };
    }));

    return NextResponse.json({
        ...tripData,
        createdAt: tripData?.createdAt.toDate(),
        updatedAt: tripData?.updatedAt.toDate(),
        startDate: tripData?.startDate ? tripData.startDate.toDate() : null,
        endDate: tripData?.endDate ? tripData.endDate.toDate() : null,
        points,
        itineraries,
        user: userData ? {
            name: userData.name,
            image: userData.image
        } : null
    });

  } catch (error) {
    console.error("Error fetching shared trip:", error);
    return NextResponse.json(
      { error: "Failed to fetch shared trip" },
      { status: 500 }
    );
  }
}
