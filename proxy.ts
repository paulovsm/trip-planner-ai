// Next 16 proxy (formerly middleware). Only redirects signed-out visitors of app
// pages to /login. It is NOT a security boundary: every API route checks auth itself.
export { auth as proxy } from "@/auth"

export const config = {
  matcher: ["/trips/:path*"],
}
