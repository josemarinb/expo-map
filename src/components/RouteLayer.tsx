import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { RouteResult } from '../lib/routing'

interface RouteLayerProps {
  map: maplibregl.Map | null
  route: RouteResult | null
}

// Secuencia fija de patrones de guiones ("hormiga marchando"). Animar
// line-dasharray con un valor fraccionario distinto en cada frame fuerza a
// MapLibre a regenerar la textura del patrón constantemente, lo que se ve
// como parpadeo. Ciclar entre un set pequeño y fijo de arrays (la técnica
// del ejemplo oficial de Mapbox) evita eso.
const SECUENCIA_GUIONES: number[][] = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],
  [3, 4, 0],
  [0, 0.5, 3, 3.5],
  [0, 1, 3, 3],
  [0, 1.5, 3, 2.5],
  [0, 2, 3, 2],
  [0, 2.5, 3, 1.5],
  [0, 3, 3, 1],
  [0, 3.5, 3, 0.5],
]

export default function RouteLayer({ map, route }: RouteLayerProps) {
  const rafRef = useRef<number | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)

  useEffect(() => {
    if (!map) return

    if (route) {
      const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        geometry: route.geojson,
        properties: {},
      }

      map.addSource('route-source', { type: 'geojson', data: geojson })
      map.addLayer({
        id: 'route-bg',
        type: 'line',
        source: 'route-source',
        paint: { 'line-color': '#FFFFFF', 'line-width': 7, 'line-opacity': 0.9 },
      })
      map.addLayer({
        id: 'route-fg',
        type: 'line',
        source: 'route-source',
        paint: { 'line-color': '#378ADD', 'line-width': 4 },
      })

      const destino = route.geojson.coordinates[
        route.geojson.coordinates.length - 1
      ] as [number, number]
      markerRef.current = new maplibregl.Marker({ color: '#E24B4A' })
        .setLngLat(destino)
        .addTo(map)

      let pasoActual = -1
      const animate = (t: number) => {
        const paso = Math.floor((t / 50) % SECUENCIA_GUIONES.length)
        if (paso !== pasoActual && map.getLayer('route-fg')) {
          map.setPaintProperty('route-fg', 'line-dasharray', SECUENCIA_GUIONES[paso])
          pasoActual = paso
        }
        rafRef.current = requestAnimationFrame(animate)
      }
      rafRef.current = requestAnimationFrame(animate)
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      if (map.getLayer('route-fg')) map.removeLayer('route-fg')
      if (map.getLayer('route-bg')) map.removeLayer('route-bg')
      if (map.getSource('route-source')) map.removeSource('route-source')
      markerRef.current?.remove()
      markerRef.current = null
    }
  }, [map, route])

  return null
}
