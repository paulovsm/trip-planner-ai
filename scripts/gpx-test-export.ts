/**
 * F1.8 risk test: generates a matrix of GPX variants to import into Huawei Health
 * and sync to the Huawei Watch GT 7, to learn what the watch accepts before the
 * export UI is built (F3).
 *
 *   npm run gpx:test-export                       # straight lines between sample points (no API cost)
 *   npm run gpx:test-export -- --points "lat,lng;lat,lng;lat,lng"   # your own route (≥2 points)
 *   npm run gpx:test-export -- --source routes    # real walking streets via Routes API
 *                                                 # (needs GOOGLE_MAPS_SERVER_KEY with Routes API enabled)
 *
 * Output: ./gpx-test/*.gpx (git-ignored) + README.txt with the test checklist.
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { buildDayGpx, decodePolyline, densify, distanceMeters, gpxFilename, type LatLng } from "../lib/gpx"

const args = process.argv.slice(2)
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? undefined : args[i + 1]
}

// Default sample: Belém → Jerónimos → LX Factory (Lisbon). Pass --points with a route near you to walk it.
const DEFAULT_POINTS = "38.6916,-9.2160;38.6979,-9.2068;38.7036,-9.1784"
const stops: LatLng[] = (arg("points") ?? DEFAULT_POINTS).split(";").map((pair) => {
  const [lat, lng] = pair.split(",").map(Number)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error(`Invalid point: ${pair}`)
  return { lat, lng }
})
if (stops.length < 2) throw new Error("Need at least 2 points")

async function routesTrack(points: LatLng[]): Promise<LatLng[]> {
  try {
    process.loadEnvFile(".env")
  } catch {
    // .env is optional when the key is exported in the shell
  }
  const key = process.env.GOOGLE_MAPS_SERVER_KEY
  if (!key) throw new Error("GOOGLE_MAPS_SERVER_KEY is not set")
  const wp = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } })
  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "routes.polyline.encodedPolyline,routes.distanceMeters,routes.warnings",
    },
    body: JSON.stringify({
      origin: wp(points[0]),
      destination: wp(points[points.length - 1]),
      intermediates: points.slice(1, -1).map(wp),
      travelMode: "WALK",
      polylineQuality: "HIGH_QUALITY",
    }),
  })
  if (!res.ok) throw new Error(`Routes API ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const encoded = data.routes?.[0]?.polyline?.encodedPolyline
  if (!encoded) throw new Error("Routes API returned no route")
  if (data.routes[0].warnings?.length) console.warn("Routes API warnings:", data.routes[0].warnings)
  return decodePolyline(encoded)
}

const length = (track: LatLng[]) => track.slice(1).reduce((sum, p, i) => sum + distanceMeters(track[i], p), 0)

async function main() {
  const source = arg("source") ?? "straight"
  const open = source === "routes" ? await routesTrack(stops) : stops
  const loopStops = [...stops, stops[0]]
  const loop = source === "routes" ? await routesTrack(loopStops) : loopStops

  const outDir = join(process.cwd(), "gpx-test")
  mkdirSync(outDir, { recursive: true })
  const files: string[] = []
  const stopNames = (n: number) => Array.from({ length: n }, (_, i) => `Parada ${i + 1}`)

  for (const [shape, track, stopList] of [
    ["aberto", open, stops],
    ["loop", loop, stops],
  ] as const) {
    const meters = length(track)
    for (const target of [500, 2000, 5000]) {
      for (const withWpt of [true, false]) {
        // Choose a densification gap that yields ~target points, and cap at target.
        const gap = Math.max(0.1, meters / target)
        const name = `Teste GT7 ${shape} ${target}pts ${withWpt ? "com" : "sem"} wpt`
        const xml = buildDayGpx({
          name,
          description: `TripPlanner F1.8 · ${source} · ${Math.round(meters)} m`,
          stops: stopList.map((s, i) => ({ ...s, name: stopNames(stopList.length)[i] })),
          track: densify(track, gap),
          mode: "walking",
          includeWaypoints: withWpt,
          maxGapMeters: gap,
          maxPoints: target,
        })
        const file = gpxFilename(`gt7-${shape}-${target}-${withWpt ? "wpt" : "nowpt"}`, new Date().toISOString().slice(0, 10))
        writeFileSync(join(outDir, file), xml)
        files.push(`${file}  (${xml.match(/<trkpt /g)?.length ?? 0} pontos, ${Math.round(meters)} m)`)
      }
    }
  }

  writeFileSync(
    join(outDir, "README.txt"),
    [
      "Teste de GPX no Huawei Watch GT 7 (TripPlanner F1.8)",
      "",
      "Para cada arquivo: Huawei Health > Eu > Minhas rotas > Importar rota > escolher o .gpx",
      "> abrir a rota > Enviar para o relógio. No relógio: Exercício > Caminhada ao ar livre > Rotas.",
      "Para rotas em loop, comece a pelo menos 30 m do ponto inicial.",
      "",
      "Anote para cada arquivo: importou? (S/N) | mostra paradas (wpt)? | sincronizou? | navegação ok?",
      "",
      ...files,
    ].join("\n"),
  )
  console.log(`Wrote ${files.length} GPX files to ${outDir}`)
  files.forEach((f) => console.log(`  ${f}`))
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
