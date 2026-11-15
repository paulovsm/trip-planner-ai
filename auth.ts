import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { FirestoreAdapter } from "@auth/firebase-adapter"
import { firestore } from "@/lib/server/firebase"

/** Lowercased emails allowed to sign in as owners (comma-separated env). */
export function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: FirestoreAdapter(firestore),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    // Allow-list: owners from env. F1.3 extends this with emails invited to a Trip.
    // Fails closed when OWNER_EMAILS is unset.
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase()
      if (!email || profile?.email_verified !== true) return false
      return ownerEmails().includes(email)
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub
      return session
    },
    // Used by proxy.ts: pages behind the matcher require a session.
    authorized({ auth }) {
      return !!auth?.user
    },
  },
})
