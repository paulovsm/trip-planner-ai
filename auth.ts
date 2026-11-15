import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { FirestoreAdapter } from "@auth/firebase-adapter"
import { firestore } from "@/lib/server/firebase"
import { claimInvites, isAllowedEmail } from "@/lib/server/commands/members"

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
  events: {
    // Turn pending invitations into memberships on every sign-in.
    async signIn({ user }) {
      if (user.id && user.email) await claimInvites(user.id, user.email)
    },
  },
  callbacks: {
    // Allow-list (ADR-0007): owners from OWNER_EMAILS plus anyone invited to a Trip.
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase()
      if (!email || profile?.email_verified !== true) return false
      return isAllowedEmail(email)
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
