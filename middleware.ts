import { withAuth } from "next-auth/middleware"

export default withAuth({
  pages: {
    signIn: "/login",
  },
})

export const config = {
  matcher: [
    "/trips/:path*",
    "/api/trips/:path*",
    "/api/gemini/:path*",
    "/api/import/:path*",
  ],
}
