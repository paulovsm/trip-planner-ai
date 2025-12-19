import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { firestore } from "@/lib/firebase";
import { nanoid } from "nanoid";

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ tripId: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const tripRef = firestore.collection('trips').doc(params.tripId);
    const tripDoc = await tripRef.get();

    if (!tripDoc.exists) {
        return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const tripData = tripDoc.data();
    
    // Get user to check email
    const userRef = firestore.collection('users').doc(tripData?.userId);
    const userDoc = await userRef.get();
    const userData = userDoc.data();

    if (userData?.email !== session.user.email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Create shared link
    const token = nanoid(10);
    const linkRef = firestore.collection('sharedLinks').doc();
    const now = new Date();
    
    const linkData = {
        id: linkRef.id,
        tripId: params.tripId,
        token,
        isActive: true,
        createdAt: now,
        expiresAt: null
    };

    await linkRef.set(linkData);

    return NextResponse.json({
        ...linkData,
        createdAt: now
    });
  } catch (error) {
    console.error("Error creating shared link:", error);
    return NextResponse.json(
      { error: "Failed to create shared link" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ tripId: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const linksRef = firestore.collection('sharedLinks');
    const snapshot = await linksRef.where('tripId', '==', params.tripId).orderBy('createdAt', 'desc').get();

    const links = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            createdAt: data.createdAt.toDate(),
            expiresAt: data.expiresAt ? data.expiresAt.toDate() : null
        }
    });

    return NextResponse.json(links);
  } catch (error) {
    console.error("Error fetching shared links:", error);
    return NextResponse.json(
      { error: "Failed to fetch shared links" },
      { status: 500 }
    );
  }
}
