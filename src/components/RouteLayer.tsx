import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { RouteResult } from '../lib/routing'

interface RouteLayerProps {
  map: maplibregl.Map | null
  route: RouteResult | null
}

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

      const animate = (t: number) => {
        const offset = (t / 100) % 10
        if (map.getLayer('route-fg')) {
          map.setPaintProperty('route-fg', 'line-dasharray', [2, offset])
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
