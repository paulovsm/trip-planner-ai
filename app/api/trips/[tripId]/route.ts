import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { firestore } from "@/lib/firebase"

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ tripId: string }> }
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
      itineraries
    })
  } catch (error) {
    console.error("Error fetching trip:", error)
    return NextResponse.json(
      { error: "Failed to fetch trip" },
      { status: 500 }
    )
  }
}

export async function PUT(
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
    const { name, description, startDate, endDate } = body

    const tripRef = firestore.collection('trips').doc(params.tripId);
    
    const updateData: any = {
      name,
      description,
      updatedAt: new Date()
    };

    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = new Date(endDate);

    await tripRef.update(updateData);
    
    const updatedDoc = await tripRef.get();
    const data = updatedDoc.data();

    return NextResponse.json({
        ...data,
        createdAt: data?.createdAt.toDate(),
        updatedAt: data?.updatedAt.toDate(),
        startDate: data?.startDate ? data.startDate.toDate() : null,
        endDate: data?.endDate ? data.endDate.toDate() : null,
    })
  } catch (error) {
    console.error("Error updating trip:", error)
    return NextResponse.json(
      { error: "Failed to update trip" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ tripId: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tripRef = firestore.collection('trips').doc(params.tripId);
    
    await firestore.recursiveDelete(tripRef);

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting trip:", error)
    return NextResponse.json(
      { error: "Failed to delete trip" },
      { status: 500 }
    )
  }
}
