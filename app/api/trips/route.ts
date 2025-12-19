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
    const { name, points } = body

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

    const tripData = {
      id: tripId,
      name,
      userId,
      createdAt: now,
      updatedAt: now,
    };

    await tripRef.set(tripData);

    // Add points as subcollection
    const pointsPromises = points.map((point: any) => {
      const pointRef = tripRef.collection('points').doc();
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
      });
    });

    await Promise.all(pointsPromises);

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
