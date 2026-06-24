export function parseWKT(wkt: string): GeoJSON.Geometry | null {
  const point = /^POINT\(\s*([-\d.]+)\s+([-\d.]+)\s*\)$/i.exec(wkt.trim())
  if (point) {
    const lon = parseFloat(point[1])
    const lat = parseFloat(point[2])
    return { type: 'Point', coordinates: [lon, lat] }
  }

  const polygon = /^POLYGON\(\(\s*(.+)\s*\)\)$/i.exec(wkt.trim())
  if (polygon) {
    const ring = polygon[1].split(',').map((pair) => {
      const [lon, lat] = pair.trim().split(/\s+/).map(Number)
      return [lon, lat] as [number, number]
    })
    return { type: 'Polygon', coordinates: [ring] }
  }

  return null
}

export function geometryToWKT(geom: GeoJSON.Geometry): string {
  if (geom.type === 'Point') {
    const [lon, lat] = geom.coordinates
    return `POINT(${lon} ${lat})`
  }

  if (geom.type === 'Polygon') {
    const ring = geom.coordinates[0]
    const puntos = ring.map(([lon, lat]) => `${lon} ${lat}`).join(',')
    return `POLYGON((${puntos}))`
  }

  throw new Error(`Tipo de geometría no soportado: ${geom.type}`)
}

export function getCentroid(geom: GeoJSON.Geometry | null): [number, number] | null {
  if (!geom) return null

  if (geom.type === 'Point') {
    return geom.coordinates as [number, number]
  }

  if (geom.type === 'Polygon') {
    const ring = geom.coordinates[0] as [number, number][]
    if (ring.length === 0) return null

    const suma = ring.reduce(
      (acc, [lon, lat]) => [acc[0] + lon, acc[1] + lat],
      [0, 0]
    )
    return [suma[0] / ring.length, suma[1] / ring.length]
  }

  return null
}

export function createDefaultPolygon(
  center: [number, number],
  sizeDeg = 0.0003
): GeoJSON.Polygon {
  const [lon, lat] = center
  const ring: [number, number][] = [
    [lon - sizeDeg, lat - sizeDeg],
    [lon + sizeDeg, lat - sizeDeg],
    [lon + sizeDeg, lat + sizeDeg],
    [lon - sizeDeg, lat + sizeDeg],
    [lon - sizeDeg, lat - sizeDeg],
  ]

  return { type: 'Polygon', coordinates: [ring] }
}

export function isValidPolygon(coords: [number, number][]): boolean {
  if (coords.length < 3) return false

  const distintos = new Set(coords.map(([lon, lat]) => `${lon},${lat}`))
  return distintos.size >= 3
}
