/* TripPlanner service worker (hand-written; no bundler integration needed).
 *
 * - App shell and Next static assets are cached so the installed app opens offline.
 * - Trip DATA is not cached here: it comes from the React Query cache persisted in
 *   IndexedDB (lib/client/persist.ts). /api/* is always network-only.
 * - Google Maps tiles/scripts are cross-origin and never cached (Maps ToS).
 * - Public share pages (/shared/*) are no-store and never cached.
 */
const VERSION = "v1"
const STATIC_CACHE = `tp-static-${VERSION}`
const PAGES_CACHE = `tp-pages-${VERSION}`
const OFFLINE_URL = "/offline"
const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/pwa-icon/192", "/pwa-icon/512"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const isCacheable = (response) =>
  response && response.ok && response.type === "basic" && !/no-store/i.test(response.headers.get("cache-control") || "")

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (isCacheable(response)) cache.put(request, response.clone())
    return response
  } catch (err) {
    const cached = await cache.match(request, { ignoreVary: true })
    if (cached) return cached
    throw err
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (isCacheable(response)) cache.put(request, response.clone())
  return response
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/shared/")) return

  // Immutable, content-hashed build assets.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request))
    return
  }

  // Page navigations: fresh when online, last visited copy (or the offline page) when not.
  if (request.mode === "navigate") {
    event.respondWith(
      networkFirst(request, PAGES_CACHE).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()),
    )
    return
  }

  // RSC payloads for client-side navigation, icons, manifest, fonts.
  if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc") || url.pathname.startsWith("/pwa-icon/")) {
    event.respondWith(networkFirst(request, PAGES_CACHE))
  }
})
