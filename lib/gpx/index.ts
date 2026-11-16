import { decode } from "@googlemaps/polyline-codec"

// Pure GPX 1.1 export for one Day (ADR-0004): a dense <trk> from the Route plus the
// Stops as named <wpt>. No elevation, no per-point time. Element order follows the
// GPX 1.1 schema (metadata, wpt*, trk*). Used client-side, so it works offline.

export type LatLng = { lat: number; lng: number }
export type GpxMode = "walking" | "cycling"

export type DayGpxInput = {
  /** Route/track name shown in Huawei Health, e.g. "Lisboa · Dia 2 (03/12)". */
  name: string
  description?: string
  stops: { name: string; lat: number; lng: number }[]
  track: LatLng[]
  mode: GpxMode
  /** Defaults to true; some watches ignore or reject waypoints (see F1.8 test matrix). */
  includeWaypoints?: boolean
  /** Track densification gap in meters (default 25). */
  maxGapMeters?: number
  /** Upper bound on track points after densify+simplify (default 2000). */
  maxPoints?: number
  /** Generation time (default now); injectable for deterministic tests. */
  time?: Date
}

const EARTH_RADIUS_M = 6_371_008.8
const rad = (deg: number) => (deg * Math.PI) / 180

export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function decodePolyline(encoded: string): LatLng[] {
  return decode(encoded, 5).map(([lat, lng]) => ({ lat, lng }))
}

/** Inserts interpolated points so no two consecutive points are more than `maxGap` meters apart. */
export function densify(points: LatLng[], maxGap = 25): LatLng[] {
  if (points.length < 2) return [...points]
  const out: LatLng[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const steps = Math.ceil(distanceMeters(a, b) / maxGap)
    for (let s = 1; s < steps; s++) {
      const t = s / steps
      out.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t })
    }
    out.push(b)
  }
  return out
}

/** Perpendicular distance (meters) from p to segment ab, using a local equirectangular projection. */
function segmentDistance(p: LatLng, a: LatLng, b: LatLng): number {
  const k = Math.cos(rad((a.lat + b.lat) / 2))
  const [px, py] = [rad(p.lng) * k, rad(p.lat)]
  const [ax, ay] = [rad(a.lng) * k, rad(a.lat)]
  const [bx, by] = [rad(b.lng) * k, rad(b.lat)]
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) * EARTH_RADIUS_M
}

function douglasPeucker(points: LatLng[], tolerance: number): LatLng[] {
  if (points.length < 3) return [...points]
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length) {
    const [start, end] = stack.pop()!
    let maxD = 0
    let idx = -1
    for (let i = start + 1; i < end; i++) {
      const d = segmentDistance(points[i], points[start], points[end])
      if (d > maxD) [maxD, idx] = [d, i]
    }
    if (idx !== -1 && maxD > tolerance) {
      keep[idx] = 1
      stack.push([start, idx], [idx, end])
    }
  }
  return points.filter((_, i) => keep[i])
}

/** Reduces the track to at most `maxPoints`, preserving shape (Douglas–Peucker with growing tolerance). */
export function simplify(points: LatLng[], maxPoints: number): LatLng[] {
  if (points.length <= maxPoints) return [...points]
  let tolerance = 0.5
  let out = douglasPeucker(points, tolerance)
  while (out.length > maxPoints && tolerance < 10_000) {
    tolerance *= 1.5
    out = douglasPeucker(points, tolerance)
  }
  if (out.length > maxPoints) {
    // Degenerate input: fall back to uniform sampling, keeping both ends.
    const step = (out.length - 1) / (maxPoints - 1)
    out = Array.from({ length: maxPoints }, (_, i) => out[Math.round(i * step)])
  }
  return out
}

/** Huawei advises starting ≥30 m away from the start point on closed routes. */
export const isLoop = (track: LatLng[], thresholdMeters = 50) =>
  track.length > 2 && distanceMeters(track[0], track[track.length - 1]) <= thresholdMeters

export function escapeXml(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

// GPX longitude must be < 180; normalize the antimeridian.
const lon = (lng: number) => (lng >= 180 ? lng - 360 : lng).toFixed(6)
const lat = (v: number) => v.toFixed(6)

const trackLength = (track: LatLng[]) => track.slice(1).reduce((sum, p, i) => sum + distanceMeters(track[i], p), 0)

/**
 * Dense track with at most `maxPoints`: first simplify the original geometry (shape),
 * then densify with the smallest gap that fits the budget. Simplifying after
 * densifying would discard the interpolated points and undo the density.
 */
export function prepareTrack(track: LatLng[], maxGapMeters = 25, maxPoints = 2000): LatLng[] {
  if (track.length < 2) return [...track]
  const shape = simplify(track, maxPoints)
  const gap = Math.max(maxGapMeters, trackLength(shape) / Math.max(1, maxPoints - shape.length))
  const dense = densify(shape, gap)
  if (dense.length <= maxPoints) return dense
  const step = (dense.length - 1) / (maxPoints - 1)
  return Array.from({ length: maxPoints }, (_, i) => dense[Math.round(i * step)])
}

export function buildDayGpx(input: DayGpxInput): string {
  const { name, description, stops, mode, includeWaypoints = true, maxGapMeters = 25, maxPoints = 2000 } = input
  const time = (input.time ?? new Date()).toISOString()
  const track = prepareTrack(input.track, maxGapMeters, maxPoints)

  const lines: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<gpx version="1.1" creator="TripPlanner" xmlns="http://www.topografix.com/GPX/1/1" ` +
      `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
      `xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">`,
    `  <metadata>`,
    `    <name>${escapeXml(name)}</name>`,
    ...(description ? [`    <desc>${escapeXml(description)}</desc>`] : []),
    `    <time>${time}</time>`,
    `  </metadata>`,
  ]
  if (includeWaypoints) {
    stops.forEach((s, i) => {
      lines.push(`  <wpt lat="${lat(s.lat)}" lon="${lon(s.lng)}">`, `    <name>${escapeXml(`${i + 1}. ${s.name}`)}</name>`, `  </wpt>`)
    })
  }
  lines.push(`  <trk>`, `    <name>${escapeXml(name)}</name>`, `    <type>${mode}</type>`, `    <trkseg>`)
  for (const p of track) lines.push(`      <trkpt lat="${lat(p.lat)}" lon="${lon(p.lng)}"/>`)
  lines.push(`    </trkseg>`, `  </trk>`, `</gpx>`, ``)
  return lines.join("\n")
}

/** ASCII-only, filesystem-safe name, e.g. "lisboa-dia-2-2026-12-03.gpx". */
export function gpxFilename(tripName: string, date: string, dayNumber?: number): string {
  const slug =
    tripName
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "viagem"
  return `${slug}${dayNumber ? `-dia-${dayNumber}` : ""}-${date}.gpx`
}
