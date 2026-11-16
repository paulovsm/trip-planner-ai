import "server-only"
import { cert, getApp, getApps, initializeApp } from "firebase-admin/app"
import { getFirestore, type Firestore } from "firebase-admin/firestore"

// Admin SDK only (bypasses Security Rules; firestore.rules denies all client access).
// When FIRESTORE_EMULATOR_HOST is set the SDK talks to the emulator automatically.
const app = getApps().length
  ? getApp()
  : initializeApp(
      process.env.FIRESTORE_EMULATOR_HOST
        ? { projectId: process.env.FIREBASE_PROJECT_ID || "demo-tripplanner" }
        : {
            credential: cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
            }),
          },
    )

// Optional fields travel as `undefined` in domain objects; drop them instead of
// failing writes. Cached on globalThis because settings can only be applied once
// (module re-evaluation in dev would otherwise throw).
const globalForFirestore = globalThis as unknown as { __tripplannerFirestore?: Firestore }

function create(): Firestore {
  const databaseId = process.env.FIRESTORE_DATABASE_ID
  const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app)
  db.settings({ ignoreUndefinedProperties: true })
  return db
}

export const firestore = (globalForFirestore.__tripplannerFirestore ??= create())
