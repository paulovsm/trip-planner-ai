"use client"

import { useEffect } from "react"

/** Registers the offline service worker (production builds only, to keep dev HMR simple). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Offline support is best-effort; the app works without it.
    })
  }, [])
  return null
}
