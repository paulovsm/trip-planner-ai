import { readFileSync } from "node:fs"
import { join } from "node:path"
import { encode } from "@googlemaps/polyline-codec"
import { describe, expect, it } from "vitest"
import { validateXML } from "xmllint-wasm"
import {
  buildDayGpx,
  decodePolyline,
  densify,
  distanceMeters,
  escapeXml,
  gpxFilename,
  isLoop,
  prepareTrack,
  simplify,
  type LatLng,
} from "./index"

const XSD = readFileSync(join(process.cwd(), "tests/fixtures/gpx-1.1.xsd"), "utf8")
const validate = (xml: string) =>
  validateXML({ xml: [{ fileName: "day.gpx", contents: xml }], schema: [{ fileName: "gpx.xsd", contents: XSD }] })

const belem = { lat: 38.6916, lng: -9.216 }
const jeronimos = { lat: 38.6979, lng: -9.2068 }
const lx = { lat: 38.7036, lng: -9.1784 }

describe("geometry", () => {
  it("measures distances (Belém → Jerónimos ≈ 1.05 km)", () => {
    expect(distanceMeters(belem, jeronimos)).toBeGreaterThan(1000)
    expect(distanceMeters(belem, jeronimos)).toBeLessThan(1100)
  })

  it("round-trips Google encoded polylines", () => {
    const decoded = decodePolyline(encode([belem, jeronimos, lx], 5))
    expect(decoded).toHaveLength(3)
    expect(decoded[2].lat).toBeCloseTo(lx.lat, 5)
  })

  it("densifies so no gap exceeds the limit", () => {
    const dense = densify([belem, jeronimos, lx], 25)
    for (let i = 1; i < dense.length; i++) expect(distanceMeters(dense[i - 1], dense[i])).toBeLessThanOrEqual(25.01)
    expect(dense[0]).toEqual(belem)
    expect(dense.at(-1)).toEqual(lx)
  })

  it("simplifies to the point cap while keeping the endpoints and shape", () => {
    const dense = densify([belem, jeronimos, lx], 1) // ~3.6 km → ~3600 points
    expect(dense.length).toBeGreaterThan(2000)
    const simple = simplify(dense, 500)
    expect(simple.length).toBeLessThanOrEqual(500)
    expect(simple[0]).toEqual(belem)
    expect(simple.at(-1)).toEqual(lx)
    // The corner at Jerónimos survives simplification.
    expect(Math.min(...simple.map((p) => distanceMeters(p, jeronimos)))).toBeLessThan(5)
  })

  it("prepares a dense track within the point budget (simplify first, then densify)", () => {
    const gaps = (t: LatLng[]) => t.slice(1).map((p, i) => distanceMeters(t[i], p))
    // Plenty of budget: every gap ≤ 25 m.
    const roomy = prepareTrack([belem, jeronimos, lx], 25, 2000)
    expect(Math.max(...gaps(roomy))).toBeLessThanOrEqual(25.01)
    // Tight budget: stays under the cap and still spreads points evenly (no collapse to the vertices).
    const tight = prepareTrack([belem, jeronimos, lx], 1, 500)
    expect(tight.length).toBeLessThanOrEqual(500)
    expect(tight.length).toBeGreaterThan(450)
    expect(Math.max(...gaps(tight))).toBeLessThan(10)
    // Already-dense straight input is not collapsed either.
    expect(prepareTrack(densify([belem, lx], 1), 1, 300).length).toBeGreaterThan(250)
  })

  it("detects loops", () => {
    expect(isLoop([belem, jeronimos, { lat: belem.lat + 0.0001, lng: belem.lng }])).toBe(true)
    expect(isLoop([belem, jeronimos, lx])).toBe(false)
  })
})

describe("buildDayGpx", () => {
  const input = {
    name: "Lisboa · Dia 1 <Belém & cia>",
    description: "Percurso a pé",
    stops: [
      { name: "Torre de Belém", ...belem },
      { name: "Mosteiro dos Jerónimos", ...jeronimos },
      { name: "LX Factory", ...lx },
    ],
    track: [belem, jeronimos, lx] as LatLng[],
    mode: "walking" as const,
    time: new Date("2026-12-03T08:00:00Z"),
  }

  it("produces schema-valid GPX 1.1", async () => {
    const result = await validate(buildDayGpx(input))
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it("is valid without waypoints and with antimeridian longitudes", async () => {
    const xml = buildDayGpx({
      ...input,
      includeWaypoints: false,
      track: [
        { lat: -16.5, lng: 179.99 },
        { lat: -16.5, lng: 180 },
      ],
    })
    expect(xml).not.toContain("<wpt")
    expect(xml).toContain('lon="-180.000000"')
    expect((await validate(xml)).valid).toBe(true)
  })

  it("numbers waypoints in Stop order, escapes text, sets the activity type", () => {
    const xml = buildDayGpx(input)
    expect(xml).toContain("<name>1. Torre de Belém</name>")
    expect(xml).toContain("<name>3. LX Factory</name>")
    expect(xml).toContain("Lisboa · Dia 1 &lt;Belém &amp; cia&gt;")
    expect(xml).toContain("<type>walking</type>")
    expect(xml).not.toContain("<ele>")
    expect(xml.indexOf("<wpt")).toBeLessThan(xml.indexOf("<trk>"))
  })

  it("honors the point cap", () => {
    const xml = buildDayGpx({ ...input, maxGapMeters: 1, maxPoints: 300 })
    expect(xml.match(/<trkpt /g)!.length).toBeLessThanOrEqual(300)
  })
})

describe("text helpers", () => {
  it("escapes XML and strips control characters", () => {
    expect(escapeXml(`a<b>&"c'\u0007`)).toBe("a&lt;b&gt;&amp;&quot;c&apos;")
  })

  it("builds ASCII filenames", () => {
    expect(gpxFilename("Férias em São Paulo!", "2026-12-03", 2)).toBe("ferias-em-sao-paulo-dia-2-2026-12-03.gpx")
    expect(gpxFilename("東京", "2026-12-03")).toBe("viagem-2026-12-03.gpx")
  })
})
