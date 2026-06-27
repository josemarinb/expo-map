export interface RouteStep {
  instruction: string
  streetName: string
  distanceM: number
}

export interface RouteResult {
  geojson: GeoJSON.LineString
  distanceM: number
  durationS: number
  steps: RouteStep[]
}

interface OsrmManeuver {
  type: string
  modifier?: string
}

interface OsrmStep {
  maneuver: OsrmManeuver
  name?: string
  distance: number
}

interface OsrmRoute {
  geometry: GeoJSON.LineString
  distance: number
  duration: number
  legs: { steps: OsrmStep[] }[]
}

interface OsrmResponse {
  code: string
  routes?: OsrmRoute[]
}

const MODIFICADORES: Record<string, string> = {
  left: 'a la izquierda',
  right: 'a la derecha',
  straight: 'derecho',
  'slight left': 'levemente a la izquierda',
  'slight right': 'levemente a la derecha',
  'sharp left': 'bruscamente a la izquierda',
  'sharp right': 'bruscamente a la derecha',
  uturn: 'en U',
}

function traducirInstruccion(maneuver: OsrmManeuver): string {
  const modificador = maneuver.modifier ? MODIFICADORES[maneuver.modifier] ?? '' : ''

  switch (maneuver.type) {
    case 'depart':
      return 'Salí'
    case 'arrive':
      return 'Llegaste a destino'
    case 'turn':
      return `Girá ${modificador}`.trim()
    case 'continue':
      return 'Seguí derecho'
    case 'merge':
      return 'Incorporate'
    case 'roundabout':
    case 'rotary':
      return 'Entrá a la rotonda'
    case 'fork':
      return `Tomá ${modificador || 'el desvío'}`.trim()
    case 'end of road':
      return `Girá ${modificador}`.trim()
    default:
      return 'Continuá'
  }
}

export async function getRoute(
  fromLon: number,
  fromLat: number,
  toLon: number,
  toLat: number
): Promise<RouteResult | null> {
  const url = `https://router.project-osrm.org/route/v1/foot/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson&steps=true`

  let data: OsrmResponse
  try {
    const res = await fetch(url)
    data = (await res.json()) as OsrmResponse
  } catch {
    return null
  }

  if (data.code !== 'Ok' || !data.routes?.length) return null

  const route = data.routes[0]

  return {
    geojson: route.geometry,
    distanceM: Math.round(route.distance),
    durationS: Math.round(route.duration),
    steps: route.legs[0].steps.map((s) => ({
      instruction: traducirInstruccion(s.maneuver),
      streetName: s.name || 'Sin nombre',
      distanceM: Math.round(s.distance),
    })),
  }
}
