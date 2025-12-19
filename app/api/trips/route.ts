import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { firestore } from "@/lib/firebase"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { name, points, startDate, endDate, importedItineraries } = body

    // Get user by email
    const usersRef = firestore.collection('users');
    const snapshot = await usersRef.where('email', '==', session.user.email).limit(1).get();

    if (snapshot.empty) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userDoc = snapshot.docs[0];
    const userId = userDoc.id;

    const tripRef = firestore.collection('trips').doc();
    const tripId = tripRef.id;
    const now = new Date();

    const tripData: any = {
      id: tripId,
      name,
      userId,
      createdAt: now,
      updatedAt: now,
    };

    if (startDate) tripData.startDate = new Date(startDate);
    if (endDate) tripData.endDate = new Date(endDate);

    await tripRef.set(tripData);

    // Add points as subcollection
    const pointsPromises = points.map((point: any) => {
      const pointRef = tripRef.collection('points').doc();
      // Store the original ID if available (from client state) or use the new doc ID
      // We need to map client-side points to server-side IDs for itinerary creation
      return pointRef.set({
        id: pointRef.id,
        name: point.name,
        description: point.description,
        category: point.category,
        address: point.address,
        city: point.city || null,
        latitude: point.latitude || 0,
        longitude: point.longitude || 0,
        createdAt: now,
        updatedAt: now,
        tripId: tripId
      }).then(() => ({ originalName: point.name, newId: pointRef.id }));
    });

    const createdPointsMap = await Promise.all(pointsPromises);

    // Create itineraries if imported
    if (importedItineraries && Array.isArray(importedItineraries)) {
      const itineraryPromises = importedItineraries.map(async (itinerary: any) => {
        const itineraryRef = tripRef.collection('itineraries').doc();
        
        // Calculate date based on start date + day offset
        let itineraryDate = now;
        if (startDate) {
          const start = new Date(startDate);
          start.setDate(start.getDate() + (itinerary.day - 1));
          itineraryDate = start;
        } else if (itinerary.date) {
          itineraryDate = new Date(itinerary.date);
        }

        // Map items names to point IDs
        const items = (itinerary.items || []).map((itemName: string, index: number) => {
          // Find the point ID by name (case insensitive)
          const pointMapping = createdPointsMap.find(p => p.originalName.toLowerCase() === itemName.toLowerCase());
          if (pointMapping) {
            return {
              id: crypto.randomUUID(),
              pointId: pointMapping.newId,
              order: index
            };
          }
          return null;
        }).filter(Boolean); // Remove items where point wasn't found

        return itineraryRef.set({
          id: itineraryRef.id,
          date: itineraryDate,
          items: items,
          createdAt: now,
          updatedAt: now,
          tripId: tripId
        });
      });

      await Promise.all(itineraryPromises);
    }

    // Fetch the created trip with points
    const pointsSnapshot = await tripRef.collection('points').get();
    const createdPoints = pointsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            createdAt: data.createdAt.toDate(),
            updatedAt: data.updatedAt.toDate()
        }
    });

    return NextResponse.json({ 
        ...tripData, 
        createdAt: tripData.createdAt,
        updatedAt: tripData.updatedAt,
        points: createdPoints 
    })
  } catch (error) {
    console.error("Error creating trip:", error)
    return NextResponse.json(
      { error: "Failed to create trip" },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const usersRef = firestore.collection('users');
    const snapshot = await usersRef.where('email', '==', session.user.email).limit(1).get();

    if (snapshot.empty) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userDoc = snapshot.docs[0];
    const userId = userDoc.id;

    const tripsRef = firestore.collection('trips');
    // Fallback to client-side sorting to avoid needing a composite index immediately
    const tripsSnapshot = await tripsRef.where('userId', '==', userId).get();

    let trips = await Promise.all(tripsSnapshot.docs.map(async doc => {
      const data = doc.data();
      // Count points
      const pointsSnapshot = await doc.ref.collection('points').count().get();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
        startDate: data.startDate?.toDate ? data.startDate.toDate() : (data.startDate ? new Date(data.startDate) : null),
        endDate: data.endDate?.toDate ? data.endDate.toDate() : (data.endDate ? new Date(data.endDate) : null),
        _count: {
          points: pointsSnapshot.data().count
        }
      };
    }));

    // Sort by updatedAt desc
    trips.sort((a: any, b: any) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return NextResponse.json(trips)
  } catch (error) {
    console.error("Error fetching trips:", error)
    return NextResponse.json(
      { error: "Failed to fetch trips" },
      { status: 500 }
    )
  }
}
