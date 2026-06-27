import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type { Evento, Zona } from '../types/map'
import { getColorZona, getIconoZona, getIconoIdZona, TODOS_LOS_ICONOS } from '../types/map'
import { registrarIconoZona } from '../lib/iconos'
import { getCentroid } from '../lib/geo'
import { getRoute } from '../lib/routing'
import type { RouteResult } from '../lib/routing'
import MapLeyenda from './MapLeyenda'
import RouteLayer from './RouteLayer'
import RoutePanel from './RoutePanel'
import { panelClases } from './panelStyles'

interface MapViewerProps {
  evento: Evento
  zonas: Zona[]
}

const CENTRO_DEFAULT: [number, number] = [-57.531271, -25.230269]
const ESTILO_MAPA = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'

function parseWKT(wkt: string): GeoJSON.Geometry | null {
  const point = /^POINT\(\s*([-\d.]+)\s+([-\d.]+)\s*\)$/i.exec(wkt.trim())
  if (point) {
    const lon = parseFloat(point[1])
    const lat = parseFloat(point[2])
    return { type: 'Point', coordinates: [lon, lat] }
  }

  const polygon = /^POLYGON\(\(\s*(.+)\s*\)\)$/i.exec(wkt.trim())
  if (polygon) {
    const ring = polygon[1]
      .split(',')
      .map((pair) => {
        const [lon, lat] = pair.trim().split(/\s+/).map(Number)
        return [lon, lat] as [number, number]
      })
    return { type: 'Polygon', coordinates: [ring] }
  }

  return null
}

function zonasToGeoJSON(zonas: Zona[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []

  for (const zona of zonas) {
    if (!zona.geom_wkt) continue
    const geometry = parseWKT(zona.geom_wkt)
    if (!geometry) continue

    const colores = getColorZona(zona.tipo)
    features.push({
      type: 'Feature',
      geometry,
      properties: {
        slug: zona.slug,
        nombre: zona.nombre,
        tipo: zona.tipo,
        icono: getIconoIdZona(zona.tipo),
        color_fill: zona.color_fill ?? colores.fill,
        color_stroke: zona.color_stroke ?? colores.stroke,
      },
    })
  }

  return { type: 'FeatureCollection', features }
}

export default function MapViewer({ evento, zonas }: MapViewerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [zonaSeleccionada, setZonaSeleccionada] = useState<Zona | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [mostrarDropdown, setMostrarDropdown] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const [vista3D, setVista3D] = useState(false)
  const [route, setRoute] = useState<RouteResult | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [panelExpandido, setPanelExpandido] = useState(false)
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null)
  const [capasVisibles, setCapasVisibles] = useState<Record<string, boolean>>({
    pabellon: true,
    salon: true,
    area_servicios: true,
    estacionamiento: true,
    parque: true,
    deposito: true,
    acceso: true,
    otro: true,
  })

  useEffect(() => {
    if (!mapContainerRef.current) return

    const centro = evento.metadata?.centro

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: ESTILO_MAPA,
      center: centro ?? CENTRO_DEFAULT,
      zoom: evento.metadata?.zoom_inicial ?? 15,
      attributionControl: false,
      maxBounds: [
        [-57.544, -25.24],
        [-57.52, -25.219],
      ],
      maxZoom: 20,
    })

    map.addControl(new maplibregl.AttributionControl(), 'bottom-right')

    map.fitBounds(
      [
        [-57.5366, -25.2329],
        [-57.526, -25.2278],
      ],
      { padding: 40, animate: false }
    )

    map.on('load', () => {
      Object.entries(TODOS_LOS_ICONOS).forEach(([id, emoji]) => {
        registrarIconoZona(map, id, emoji)
      })

      setMapLoaded(true)
    })

    mapRef.current = map
    setMapInstance(map)

    return () => {
      map.remove()
      mapRef.current = null
      setMapInstance(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const geojson = zonasToGeoJSON(zonas)
    const source = map.getSource('zonas-source') as maplibregl.GeoJSONSource | undefined

    if (source) {
      source.setData(geojson)
      return
    }

    map.addSource('zonas-source', { type: 'geojson', data: geojson })

    map.addLayer({
      id: 'zonas-fill',
      type: 'fill',
      source: 'zonas-source',
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'fill-color': ['get', 'color_fill'],
        'fill-opacity': 0.45,
      },
    })

    // Variante 3D (oculta por defecto): mismo polígono con un relieve sutil
    map.addLayer({
      id: 'zonas-fill-3d',
      type: 'fill-extrusion',
      source: 'zonas-source',
      filter: ['==', ['geometry-type'], 'Polygon'],
      layout: { visibility: 'none' },
      paint: {
        'fill-extrusion-color': ['get', 'color_fill'],
        'fill-extrusion-height': 6,
        'fill-extrusion-opacity': 0.85,
      },
    })

    map.addLayer({
      id: 'zonas-stroke',
      type: 'line',
      source: 'zonas-source',
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'line-color': ['get', 'color_stroke'],
        'line-width': 1,
      },
    })

    map.addLayer({
      id: 'zonas-label',
      type: 'symbol',
      source: 'zonas-source',
      filter: ['==', ['geometry-type'], 'Polygon'],
      layout: {
        'icon-image': ['get', 'icono'],
        'icon-size': 0.4,
        'icon-anchor': 'bottom',
        'text-field': ['get', 'nombre'],
        'text-size': 11,
        'text-anchor': 'top',
        'text-offset': [0, 0.2],
      },
      paint: {
        'text-color': '#16382B',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
      },
    })

    map.addLayer({
      id: 'zonas-point',
      type: 'circle',
      source: 'zonas-source',
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-color': ['get', 'color_fill'],
        'circle-radius': 10,
        'circle-stroke-color': ['get', 'color_stroke'],
        'circle-stroke-width': 1.5,
      },
    })

    map.addLayer({
      id: 'zonas-point-icon',
      type: 'symbol',
      source: 'zonas-source',
      filter: ['==', ['geometry-type'], 'Point'],
      layout: {
        'icon-image': ['get', 'icono'],
        'icon-size': 0.35,
        'icon-allow-overlap': true,
      },
    })
  }, [zonas, mapLoaded])

  // ── Click en zona → abrir panel de info ───────────────────────────────
  // Efecto separado del anterior: así el handler siempre cierra sobre el
  // `zonas` actual. Si viviera en el mismo efecto que crea las layers (que
  // solo corre una vez), quedaría con una referencia vieja/vacía a `zonas`.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const onClickZona = (e: maplibregl.MapLayerMouseEvent) => {
      const feature = e.features?.[0]
      if (!feature) return
      const slug = feature.properties?.slug as string | undefined
      const nombre = feature.properties?.nombre as string | undefined
      const zona = zonas.find((z) => z.slug === slug)
      if (!zona) return

      setZonaSeleccionada(zona)
      setPanelExpandido(false)

      popupRef.current?.remove()
      popupRef.current = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 5,
        className: 'zona-popup',
      })
        .setLngLat(e.lngLat)
        .setHTML(`<span style="font-size:12px;font-weight:500">${nombre ?? zona.nombre}</span>`)
        .addTo(map)
    }

    const onEnter = () => {
      map.getCanvas().style.cursor = 'pointer'
    }
    const onLeave = () => {
      map.getCanvas().style.cursor = ''
    }

    map.on('click', 'zonas-fill', onClickZona)
    map.on('click', 'zonas-point', onClickZona)
    map.on('mouseenter', 'zonas-fill', onEnter)
    map.on('mouseleave', 'zonas-fill', onLeave)
    map.on('mouseenter', 'zonas-point', onEnter)
    map.on('mouseleave', 'zonas-point', onLeave)

    return () => {
      map.off('click', 'zonas-fill', onClickZona)
      map.off('click', 'zonas-point', onClickZona)
      map.off('mouseenter', 'zonas-fill', onEnter)
      map.off('mouseleave', 'zonas-fill', onLeave)
      map.off('mouseenter', 'zonas-point', onEnter)
      map.off('mouseleave', 'zonas-point', onLeave)
    }
  }, [zonas, mapLoaded])

  useEffect(() => {
    const handleClickFuera = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setMostrarDropdown(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMostrarDropdown(false)
    }
    document.addEventListener('mousedown', handleClickFuera)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickFuera)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  function cerrarPanel() {
    setZonaSeleccionada(null)
    setPanelExpandido(false)
    popupRef.current?.remove()
    popupRef.current = null
  }

  function handleResetView() {
    const bounds = evento.metadata?.plano_bounds
    if (!bounds || bounds.length !== 4) return
    mapRef.current?.fitBounds(
      [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]],
      ],
      { padding: 40, duration: 600 }
    )
  }

  function handleToggleCapa(tipo: string) {
    const nuevasCapas = { ...capasVisibles, [tipo]: !capasVisibles[tipo] }
    setCapasVisibles(nuevasCapas)

    const map = mapRef.current
    if (map) {
      const tiposOcultos = Object.entries(nuevasCapas)
        .filter(([, visible]) => !visible)
        .map(([t]) => t)

      const baseGeom = ['==', ['geometry-type'], 'Polygon'] as maplibregl.ExpressionSpecification

      const exclusiones = tiposOcultos.map(
        (t) => ['!=', ['get', 'tipo'], t] as maplibregl.ExpressionSpecification
      )

      const filtro = ['all', baseGeom, ...exclusiones] as maplibregl.FilterSpecification

      map.setFilter('zonas-fill', filtro)
      map.setFilter('zonas-fill-3d', filtro)
      map.setFilter('zonas-stroke', filtro)
      map.setFilter('zonas-label', filtro)
    }

    if (zonaSeleccionada && zonaSeleccionada.tipo === tipo && nuevasCapas[tipo] === false) {
      cerrarPanel()
    }
  }

  function handleToggleVista3D() {
    const map = mapRef.current
    if (!map) return

    const nuevoValor = !vista3D
    setVista3D(nuevoValor)

    map.setLayoutProperty('zonas-fill', 'visibility', nuevoValor ? 'none' : 'visible')
    map.setLayoutProperty('zonas-fill-3d', 'visibility', nuevoValor ? 'visible' : 'none')
    map.easeTo({ pitch: nuevoValor ? 45 : 0, duration: 600 })
  }

  function handleComoLlegar() {
    if (!zonaSeleccionada) return

    if (!navigator.geolocation) {
      alert('Activá la ubicación para usar esta función')
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { longitude: fromLon, latitude: fromLat } = pos.coords

        const geom = parseWKT(zonaSeleccionada.geom_wkt ?? '')
        const centro = getCentroid(geom)
        if (!centro) return

        setRouteLoading(true)
        const result = await getRoute(fromLon, fromLat, centro[0], centro[1])
        setRouteLoading(false)

        if (!result) {
          alert('No se pudo calcular la ruta. Intentá de nuevo.')
          return
        }

        setRoute(result)
        setZonaSeleccionada(null)
        setPanelExpandido(false)

        const map = mapRef.current
        if (map && result.geojson.coordinates.length) {
          const lons = result.geojson.coordinates.map((c) => c[0])
          const lats = result.geojson.coordinates.map((c) => c[1])
          map.fitBounds(
            [
              [Math.min(...lons), Math.min(...lats)],
              [Math.max(...lons), Math.max(...lats)],
            ],
            { padding: 60, duration: 800 }
          )
        }
      },
      () => alert('Activá la ubicación para usar esta función')
    )
  }

  function handleCancelarRuta() {
    setRoute(null)
    setPanelExpandido(false)
  }

  function handleGPS() {
    if (!navigator.geolocation) {
      alert('No se pudo obtener tu ubicación')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const map = mapRef.current
        if (!map) return

        const { longitude, latitude } = position.coords
        const geojson: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [longitude, latitude] },
              properties: {},
            },
          ],
        }

        const source = map.getSource('user-location-source') as
          | maplibregl.GeoJSONSource
          | undefined

        if (source) {
          source.setData(geojson)
        } else {
          map.addSource('user-location-source', { type: 'geojson', data: geojson })
          map.addLayer({
            id: 'user-location-layer',
            type: 'circle',
            source: 'user-location-source',
            paint: {
              'circle-color': '#378ADD',
              'circle-radius': 8,
              'circle-stroke-color': '#fff',
              'circle-stroke-width': 2,
            },
          })
        }

        map.flyTo({ center: [longitude, latitude], zoom: 17 })
      },
      () => {
        alert('No se pudo obtener tu ubicación')
      }
    )
  }

  const resultados =
    busqueda.length >= 2
      ? zonas
          .filter((z) => z.nombre.toLowerCase().includes(busqueda.toLowerCase()))
          .slice(0, 5)
      : []

  function handleSeleccionarResultado(zona: Zona) {
    setZonaSeleccionada(zona)
    setBusqueda('')
    setMostrarDropdown(false)

    const map = mapRef.current
    if (!map || !zona.geom_wkt) return
    const geometry = parseWKT(zona.geom_wkt)
    if (!geometry) return

    let centro: [number, number] | null = null
    if (geometry.type === 'Point') {
      centro = geometry.coordinates as [number, number]
    } else if (geometry.type === 'Polygon') {
      const ring = geometry.coordinates[0] as [number, number][]
      const lons = ring.map((c) => c[0])
      const lats = ring.map((c) => c[1])
      centro = [
        (Math.min(...lons) + Math.max(...lons)) / 2,
        (Math.min(...lats) + Math.max(...lats)) / 2,
      ]
    }

    if (centro) map.flyTo({ center: centro, zoom: 17 })
  }

  return (
    <div className="flex h-dvh w-full">
      <div className="relative flex-1">
        <div ref={mapContainerRef} className="h-dvh w-full" />

        <div
          ref={searchContainerRef}
          className="absolute left-1/2 -translate-x-1/2 z-10"
          style={{ width: 'min(360px, 90vw)', top: 'max(1rem, env(safe-area-inset-top))' }}
        >
          <input
            type="text"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value)
              setMostrarDropdown(true)
            }}
            onFocus={() => setMostrarDropdown(true)}
            placeholder="Buscar pabellón, stand, servicio..."
            className="w-full rounded-full bg-white px-4 py-2 text-sm shadow-md outline-none focus:ring-2 focus:ring-brand-green/40"
          />

          {mostrarDropdown && resultados.length > 0 && (
            <div className="mt-2 rounded-xl bg-white shadow-md overflow-hidden">
              {resultados.map((zona) => (
                <button
                  key={zona.id}
                  type="button"
                  onClick={() => handleSeleccionarResultado(zona)}
                  className="w-full flex items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-50"
                >
                  <span>
                    {getIconoZona(zona.tipo)} {zona.nombre}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: getColorZona(zona.tipo).fill,
                      color: getColorZona(zona.tipo).stroke,
                    }}
                  >
                    {zona.tipo}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          className="absolute left-6 z-10"
          style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          <MapLeyenda capasVisibles={capasVisibles} onToggle={handleToggleCapa} />
        </div>

        <div
          className="absolute right-6 z-10 flex flex-col gap-2"
          style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={handleToggleVista3D}
            className={`flex h-11 w-11 items-center justify-center rounded-full text-xs font-semibold shadow-md ${
              vista3D ? 'bg-brand-green text-white' : 'bg-white text-brand-dark'
            }`}
            aria-label="Vista 3D"
          >
            3D
          </button>

          <button
            type="button"
            onClick={handleResetView}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-md"
            aria-label="Restablecer vista"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-5 w-5 text-brand-dark"
            >
              <path d="M3 9l9-6 9 6" />
              <path d="M5 10v9a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1v-9" />
            </svg>
          </button>

          <button
            type="button"
            onClick={handleGPS}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-md"
            aria-label="Mi ubicación"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-5 w-5 text-brand-dark"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </button>
        </div>

        <RouteLayer map={mapInstance} route={route} />
      </div>

      {route ? (
        <RoutePanel
          route={route}
          expandido={panelExpandido}
          onToggleExpandido={() => setPanelExpandido((v) => !v)}
          onCancelar={handleCancelarRuta}
        />
      ) : (
        zonaSeleccionada && (
          <PanelInfo
            zona={zonaSeleccionada}
            expandido={panelExpandido}
            onToggleExpandido={() => setPanelExpandido((v) => !v)}
            onClose={cerrarPanel}
            onComoLlegar={handleComoLlegar}
            cargandoRuta={routeLoading}
          />
        )
      )}
    </div>
  )
}

function PanelInfo({
  zona,
  expandido,
  onToggleExpandido,
  onClose,
  onComoLlegar,
  cargandoRuta,
}: {
  zona: Zona
  expandido: boolean
  onToggleExpandido: () => void
  onClose: () => void
  onComoLlegar: () => void
  cargandoRuta: boolean
}) {
  const colores = getColorZona(zona.tipo)

  // En desktop el panel siempre muestra todo (es un sidebar fijo, no tapa
  // nada). En mobile, la foto/descripción/horario solo se ven si está
  // expandido — colapsado deja ver el mapa.
  const mostrarDetalle = 'md:block ' + (expandido ? 'block' : 'hidden')

  return (
    <div className={panelClases(expandido)}>
      <button
        type="button"
        onClick={onToggleExpandido}
        className="flex w-full justify-center pt-2 pb-1 md:hidden"
        aria-label={expandido ? 'Minimizar' : 'Ver detalle'}
      >
        <div className="h-1.5 w-10 rounded-full bg-gray-300" />
      </button>

      <div className="flex items-start justify-between gap-2 px-4 pt-1 pb-2 md:pt-4">
        <div>
          <span
            className="inline-block text-xs px-2 py-0.5 rounded-full mb-1"
            style={{ backgroundColor: colores.fill, color: colores.stroke }}
          >
            {getIconoZona(zona.tipo)} {zona.tipo}
          </span>
          <h2 className="text-lg font-medium text-brand-dark">{zona.nombre}</h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>

      <div className="px-4 pb-3">
        {cargandoRuta ? (
          <div className="flex w-full items-center justify-center rounded-lg border border-brand-green py-2">
            <div className="h-4 w-4 rounded-full border-2 border-brand-green/30 border-t-brand-green animate-spin" />
          </div>
        ) : (
          <button
            type="button"
            onClick={onComoLlegar}
            className="w-full border border-brand-green text-brand-green rounded-lg py-2 text-sm hover:bg-brand-green/5"
          >
            Cómo llegar
          </button>
        )}
      </div>

      <div className={`${mostrarDetalle} flex-1 overflow-y-auto`}>
        {zona.foto_url && (
          <img
            src={zona.foto_url}
            alt={zona.nombre}
            className="w-full h-[140px] object-cover"
          />
        )}

        <div
          className="px-4 py-3"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          {zona.descripcion && (
            <p className="text-sm text-gray-500 mb-3">{zona.descripcion}</p>
          )}

          {zona.horario_apertura && (
            <p className="text-sm text-gray-600 mb-1">
              Horario: {zona.horario_apertura} – {zona.horario_cierre}
            </p>
          )}

          {zona.capacidad_vehiculos !== null && (
            <p className="text-sm text-gray-600 mb-1">
              Capacidad: {zona.capacidad_vehiculos} vehículos
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
