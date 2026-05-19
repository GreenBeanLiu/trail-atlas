import { XMLParser } from 'fast-xml-parser'

export type ParsedPoint = {
  lat: number
  lon: number
  elevation: number
  timestamp: string | null
}

export type ParsedTrack = {
  name: string
  points: ParsedPoint[]
  distance: number   // km
  elevGain: number   // m
  duration: number   // seconds
  date: string       // ISO
}

export function parseGpx(xml: string): ParsedTrack | null {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      isArray: (name) => ['trkpt', 'rtept', 'wpt', 'trkseg'].includes(name),
    })
    const doc = parser.parse(xml)
    const gpx = doc.gpx

    // Try track segments first, then route points
    let rawPoints: unknown[] = []
    const trk = gpx?.trk
    const trkObj = Array.isArray(trk) ? trk[0] : trk
    const segments: unknown[] = trkObj?.trkseg ?? []
    for (const seg of segments) {
      const pts = (seg as Record<string, unknown>).trkpt
      if (Array.isArray(pts)) rawPoints.push(...pts)
    }

    // Fall back to route points
    if (rawPoints.length === 0) {
      const rte = gpx?.rte
      const rteObj = Array.isArray(rte) ? rte[0] : rte
      rawPoints = rteObj?.rtept ?? []
    }

    if (rawPoints.length === 0) return null

    const points: ParsedPoint[] = rawPoints.map((p) => {
      const pt = p as Record<string, unknown>
      return {
        lat: parseFloat(String(pt['@_lat'] ?? 0)),
        lon: parseFloat(String(pt['@_lon'] ?? 0)),
        elevation: parseFloat(String((pt.ele as string | undefined) ?? '0')) || 0,
        timestamp: (pt.time as string | undefined) ?? null,
      }
    }).filter((p) => !isNaN(p.lat) && !isNaN(p.lon))

    const name = (
      (Array.isArray(gpx?.trk) ? gpx.trk[0]?.name : gpx?.trk?.name) ??
      gpx?.metadata?.name ??
      '未命名路线'
    )

    const distance = calcDistance(points)
    const elevGain = calcElevGain(points)
    const { duration, date } = calcDurationAndDate(points)

    return { name: String(name), points, distance, elevGain, duration, date }
  } catch {
    return null
  }
}

// ── Stats helpers ─────────────────────────────────────────────────

const R = 6371000 // earth radius in m

function haversine(a: ParsedPoint, b: ParsedPoint): number {
  const φ1 = (a.lat * Math.PI) / 180
  const φ2 = (b.lat * Math.PI) / 180
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180
  const Δλ = ((b.lon - a.lon) * Math.PI) / 180
  const s = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

function calcDistance(points: ParsedPoint[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += haversine(points[i - 1], points[i])
  }
  return Math.round(total) / 1000 // km
}

function calcElevGain(points: ParsedPoint[]): number {
  let gain = 0
  for (let i = 1; i < points.length; i++) {
    const diff = points[i].elevation - points[i - 1].elevation
    if (diff > 0) gain += diff
  }
  return Math.round(gain)
}

function calcDurationAndDate(points: ParsedPoint[]): { duration: number; date: string } {
  const timestamps = points.map((p) => p.timestamp).filter(Boolean) as string[]
  if (timestamps.length >= 2) {
    const start = new Date(timestamps[0]).getTime()
    const end = new Date(timestamps[timestamps.length - 1]).getTime()
    return {
      duration: Math.max(0, Math.round((end - start) / 1000)),
      date: timestamps[0],
    }
  }
  const now = new Date().toISOString()
  return { duration: 0, date: now }
}
