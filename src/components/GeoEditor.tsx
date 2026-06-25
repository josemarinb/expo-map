import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type { Evento, Zona, ZonaTipo } from '../types/map'
import { ZONA_COLORES, getColorZona, getIconoZona, getIconoIdZona, TODOS_LOS_ICONOS } from '../types/map'
import {
  useZonasGeoEditor,
  useSaveGeom,
  useUpdateZonaInfo,
  useCreateZona,
} from '../hooks/useGeoEditor'
import { parseWKT, geometryToWKT, getCentroid } from '../lib/geo'
import { registrarIconoZona } from '../lib/iconos'

interface GeoEditorProps {
  evento: Evento
}

type DrawMode = 'navigate' | 'point' | 'polygon' | 'edit'
type TabPanel = 'sin' | 'completadas'
type Toast = { msg: string; type: 'success' | 'error' } | null

const CENTRO_DEFAULT: [number, number] = [-57.531271, -25.230269]
const ESTILO_MAPA = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
const RADIO_VERTICE_PX = 15
const TIPOS_ZONA = Object.keys(ZONA_COLORES)

function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function generarSlugUnico(nombre: string, existentes: string[]): string {
  const base = slugify(nombre) || 'zona'
  let candidato = base
  let i = 2
  while (existentes.includes(candidato)) {
    candidato = `${base}-${i}`
    i++
  }
  return candidato
}

function getEventoCentro(evento: Evento): [number, number] {
  if (evento.metadata?.centro) return evento.metadata.centro
  const bounds = evento.metadata?.plano_bounds
  if (bounds) return [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2]
  return CENTRO_DEFAULT
}

function construirGeojsonDibujo(
  coords: [number, number][],
  cerrado: boolean
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []

  if (coords.length >= 2) {
    features.push({
      type: 'Feature',
      geometry: cerrado
        ? { type: 'Polygon', coordinates: [[...coords, coords[0]]] }
        : { type: 'LineString', coordinates: coords },
      properties: {},
    })
  }

  coords.forEach((coord, idx) => {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: coord },
      properties: { idx },
    })
  })

  return { type: 'FeatureCollection', features }
}

function zonasExistentesGeoJSON(zonas: Zona[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []

  for (const zona of zonas) {
    if (!zona.geom_wkt) continue
    const geometry = parseWKT(zona.geom_wkt)
    if (!geometry) continue

    features.push({
      type: 'Feature',
      geometry,
      properties: {
        slug: zona.slug,
        nombre: zona.nombre,
        icono: getIconoIdZona(zona.tipo),
      },
    })
  }

  return { type: 'FeatureCollection', features }
}

export default function GeoEditor({ evento }: GeoEditorProps) {
  const { zonas, zonasConGeom, zonasSinGeom, refetch } = useZonasGeoEditor(evento.id)
  const { saving, error: saveError, saveGeom } = useSaveGeom()
  const { saving: savingInfo, error: infoError, updateZonaInfo } = useUpdateZonaInfo()
  const { creating: creatingZona, error: createError, createZona } = useCreateZona()

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  const editCoordsRef = useRef<[number, number][]>([])
  const activeVertexRef = useRef<number | null>(null)

  const [tab, setTab] = useState<TabPanel>('sin')
  const [zonaSeleccionada, setZonaSeleccionada] = useState<Zona | null>(null)
  const [nombreEdit, setNombreEdit] = useState('')
  const [tipoEdit, setTipoEdit] = useState('')
  const [mostrarFormNueva, setMostrarFormNueva] = useState(false)
  const [nombreNueva, setNombreNueva] = useState('')
  const [tipoNueva, setTipoNueva] = useState<string>(TIPOS_ZONA[0])
  const [drawMode, setDrawMode] = useState<DrawMode>('navigate')
  const [drawingCoords, setDrawingCoords] = useState<[number, number][]>([])
  const [pendingWKT, setPendingWKT] = useState<string | null>(null)
  const [planoOpacity, setPlanoOpacity] = useState(0.5)
  const [planoCargado, setPlanoCargado] = useState(false)
  const [toast, setToast] = useState<Toast>(null)
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lon: number } | null>(null)
  const toastTimeoutRef = useRef<number | null>(null)

  function mostrarToast(nuevoToast: NonNullable<Toast>) {
    setToast(nuevoToast)
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = window.setTimeout(() => setToast(null), 3000)
  }

  function setFuente(id: string, geojson: GeoJSON.FeatureCollection) {
    const source = mapRef.current?.getSource(id) as maplibregl.GeoJSONSource | undefined
    source?.setData(geojson)
  }

  function vaciarFuente(id: string) {
    setFuente(id, { type: 'FeatureCollection', features: [] })
  }

  function limpiarDibujo() {
    setDrawingCoords([])
    editCoordsRef.current = []
    activeVertexRef.current = null
    vaciarFuente('zona-edit')
    vaciarFuente('preview-line')
  }

  // ── Inicialización del mapa ──────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return

    const bounds = evento.metadata?.plano_bounds
    const centro = evento.metadata?.centro

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: ESTILO_MAPA,
      center: centro ?? CENTRO_DEFAULT,
      zoom: evento.metadata?.zoom_inicial ?? 15,
      attributionControl: false,
    })

    map.addControl(new maplibregl.AttributionControl(), 'bottom-right')

    if (bounds && bounds.length === 4) {
      map.fitBounds(
        [
          [bounds[0], bounds[1]],
          [bounds[2], bounds[3]],
        ],
        { padding: 40, animate: false }
      )
    }

    map.on('load', () => {
      Object.entries(TODOS_LOS_ICONOS).forEach(([id, emoji]) => {
        registrarIconoZona(map, id, emoji)
      })

      const planoImagenUrl = evento.metadata?.plano_imagen_url
      const corners = evento.metadata?.imagen_corners

      const coordinates: [
        [number, number],
        [number, number],
        [number, number],
        [number, number],
      ] | null = corners
        ? corners
        : bounds
          ? [
              [bounds[0], bounds[3]],
              [bounds[2], bounds[3]],
              [bounds[2], bounds[1]],
              [bounds[0], bounds[1]],
            ]
          : null

      if (planoImagenUrl && coordinates) {
        map.addSource('plano-source', { type: 'image', url: planoImagenUrl, coordinates })
        map.addLayer({
          id: 'plano-layer',
          type: 'raster',
          source: 'plano-source',
          paint: { 'raster-opacity': 0.5 },
        })
        setPlanoCargado(true)
      }

      map.addSource('zonas-existentes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'zonas-existentes-fill',
        type: 'fill',
        source: 'zonas-existentes',
        paint: { 'fill-color': '#2E7D32', 'fill-opacity': 0.15 },
      })
      map.addLayer({
        id: 'zonas-existentes-stroke',
        type: 'line',
        source: 'zonas-existentes',
        paint: { 'line-color': '#2E7D32', 'line-width': 1 },
      })
      map.addLayer({
        id: 'zonas-existentes-label',
        type: 'symbol',
        source: 'zonas-existentes',
        filter: ['==', ['geometry-type'], 'Polygon'],
        layout: {
          'icon-image': ['get', 'icono'],
          'icon-size': 0.35,
          'icon-anchor': 'bottom',
          'text-field': ['get', 'nombre'],
          'text-size': 10,
          'text-anchor': 'top',
          'text-offset': [0, 0.2],
        },
        paint: { 'text-color': '#16382B', 'text-halo-color': '#fff', 'text-halo-width': 1 },
      })
      map.addLayer({
        id: 'zonas-existentes-points',
        type: 'circle',
        source: 'zonas-existentes',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: { 'circle-color': '#2E7D32', 'circle-radius': 6, 'circle-opacity': 0.6 },
      })
      map.addLayer({
        id: 'zonas-existentes-points-icon',
        type: 'symbol',
        source: 'zonas-existentes',
        filter: ['==', ['geometry-type'], 'Point'],
        layout: { 'icon-image': ['get', 'icono'], 'icon-size': 0.3, 'icon-allow-overlap': true },
      })

      map.addSource('preview-line', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'preview-line-layer',
        type: 'line',
        source: 'preview-line',
        paint: { 'line-color': '#C0892C', 'line-width': 1.5, 'line-dasharray': [2, 2] },
      })

      map.addSource('zona-edit', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'zona-edit-fill',
        type: 'fill',
        source: 'zona-edit',
        paint: { 'fill-color': '#C0892C', 'fill-opacity': 0.25 },
      })
      map.addLayer({
        id: 'zona-edit-stroke',
        type: 'line',
        source: 'zona-edit',
        paint: { 'line-color': '#C0892C', 'line-width': 1.5, 'line-dasharray': [2, 2] },
      })
      map.addLayer({
        id: 'zona-edit-points',
        type: 'circle',
        source: 'zona-edit',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-color': '#C0892C',
          'circle-radius': 6,
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2,
        },
      })

      setMapLoaded(true)
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Zonas existentes (capa azul) ─────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return
    setFuente('zonas-existentes', zonasExistentesGeoJSON(zonas))
  }, [zonas, mapLoaded])

  // ── Click en zona existente → seleccionarla en el panel ──────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const onClick = (e: maplibregl.MapLayerMouseEvent) => {
      const slug = e.features?.[0]?.properties?.slug as string | undefined
      const zona = zonas.find((z) => z.slug === slug)
      if (zona) seleccionarZona(zona)
    }
    const onEnter = () => map.getCanvas().style.cursor = 'pointer'
    const onLeave = () => map.getCanvas().style.cursor = ''

    map.on('click', 'zonas-existentes-fill', onClick)
    map.on('click', 'zonas-existentes-points', onClick)
    map.on('mouseenter', 'zonas-existentes-fill', onEnter)
    map.on('mouseleave', 'zonas-existentes-fill', onLeave)

    return () => {
      map.off('click', 'zonas-existentes-fill', onClick)
      map.off('click', 'zonas-existentes-points', onClick)
      map.off('mouseenter', 'zonas-existentes-fill', onEnter)
      map.off('mouseleave', 'zonas-existentes-fill', onLeave)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zonas, mapLoaded])

  // ── Modo punto / polígono: clicks y mousemove sobre el mapa ──────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    if (drawMode === 'point') {
      map.getCanvas().style.cursor = 'crosshair'

      const onClick = (e: maplibregl.MapMouseEvent) => {
        const coord: [number, number] = [e.lngLat.lng, e.lngLat.lat]
        setFuente('zona-edit', construirGeojsonDibujo([coord], false))
        setPendingWKT(geometryToWKT({ type: 'Point', coordinates: coord }))
      }

      map.on('click', onClick)
      return () => {
        map.off('click', onClick)
        map.getCanvas().style.cursor = ''
      }
    }

    if (drawMode === 'polygon') {
      map.getCanvas().style.cursor = 'crosshair'

      const onClick = (e: maplibregl.MapMouseEvent) => {
        const punto: [number, number] = [e.lngLat.lng, e.lngLat.lat]

        if (drawingCoords.length >= 3) {
          const pxPrimer = map.project(drawingCoords[0])
          const pxClick = map.project(punto)
          const dist = Math.hypot(pxPrimer.x - pxClick.x, pxPrimer.y - pxClick.y)
          if (dist < RADIO_VERTICE_PX) {
            cerrarPoligono()
            return
          }
        }

        const nuevos = [...drawingCoords, punto]
        setDrawingCoords(nuevos)
        setFuente('zona-edit', construirGeojsonDibujo(nuevos, nuevos.length >= 3))
        vaciarFuente('preview-line')
      }

      const onMouseMove = (e: maplibregl.MapMouseEvent) => {
        if (drawingCoords.length === 0) return
        const cursor: [number, number] = [e.lngLat.lng, e.lngLat.lat]
        setFuente('preview-line', {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [drawingCoords[drawingCoords.length - 1], cursor],
              },
              properties: {},
            },
          ],
        })
      }

      map.on('click', onClick)
      map.on('mousemove', onMouseMove)
      return () => {
        map.off('click', onClick)
        map.off('mousemove', onMouseMove)
        map.getCanvas().style.cursor = ''
      }
    }

    if (drawMode === 'edit') {
      const onMouseDown = (e: maplibregl.MapMouseEvent) => {
        const pxClick = map.project(e.lngLat)
        let indiceCercano: number | null = null
        let distMin = Infinity

        editCoordsRef.current.forEach((coord, idx) => {
          const px = map.project(coord)
          const dist = Math.hypot(px.x - pxClick.x, px.y - pxClick.y)
          if (dist < RADIO_VERTICE_PX && dist < distMin) {
            distMin = dist
            indiceCercano = idx
          }
        })

        if (indiceCercano === null) return
        activeVertexRef.current = indiceCercano
        map.dragPan.disable()
        map.getCanvas().style.cursor = 'grabbing'
      }

      const onMouseMoveWindow = (e: MouseEvent) => {
        if (activeVertexRef.current === null) return
        const rect = map.getContainer().getBoundingClientRect()
        const lngLat = map.unproject([e.clientX - rect.left, e.clientY - rect.top])

        editCoordsRef.current[activeVertexRef.current] = [lngLat.lng, lngLat.lat]
        setFuente('zona-edit', construirGeojsonDibujo(editCoordsRef.current, editCoordsRef.current.length >= 3))
      }

      const onMouseUpWindow = () => {
        if (activeVertexRef.current === null) return
        activeVertexRef.current = null
        map.dragPan.enable()
        map.getCanvas().style.cursor = ''

        const coords = editCoordsRef.current
        if (coords.length === 1) {
          setPendingWKT(geometryToWKT({ type: 'Point', coordinates: coords[0] }))
        } else if (coords.length >= 3) {
          setPendingWKT(
            geometryToWKT({ type: 'Polygon', coordinates: [[...coords, coords[0]]] })
          )
        }
      }

      map.on('mousedown', onMouseDown)
      window.addEventListener('mousemove', onMouseMoveWindow)
      window.addEventListener('mouseup', onMouseUpWindow)

      return () => {
        map.off('mousedown', onMouseDown)
        window.removeEventListener('mousemove', onMouseMoveWindow)
        window.removeEventListener('mouseup', onMouseUpWindow)
        map.dragPan.enable()
      }
    }

    map.getCanvas().style.cursor = ''
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cerrarPoligono/vaciarFuente se recrean cada render
  }, [drawMode, drawingCoords, mapLoaded])

  // ── Toast de error al guardar/borrar ──────────────────────────────────
  useEffect(() => {
    if (saveError) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacciona a un cambio de estado externo (RPC)
      mostrarToast({ msg: `Error al guardar: ${saveError.message}`, type: 'error' })
    }
  }, [saveError])

  // ── Toast de error al actualizar nombre/tipo ──────────────────────────
  useEffect(() => {
    if (infoError) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacciona a un cambio de estado externo (RPC)
      mostrarToast({ msg: `Error al actualizar: ${infoError.message}`, type: 'error' })
    }
  }, [infoError])

  // ── Toast de error al crear zona ──────────────────────────────────────
  useEffect(() => {
    if (createError) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacciona a un cambio de estado externo (RPC)
      mostrarToast({ msg: `Error al crear zona: ${createError.message}`, type: 'error' })
    }
  }, [createError])

  // ── Coordenadas del cursor (modo punto / polígono) ────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded || (drawMode !== 'point' && drawMode !== 'polygon')) {
      setCursorCoords(null)
      return
    }

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      setCursorCoords({ lat: e.lngLat.lat, lon: e.lngLat.lng })
    }

    map.on('mousemove', onMouseMove)
    return () => {
      map.off('mousemove', onMouseMove)
    }
  }, [drawMode, mapLoaded])

  // ── Atajos de teclado ──────────────────────────────────────────────--
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleDescartar()
      } else if (e.key === 'Enter') {
        if (drawMode === 'polygon' && drawingCoords.length >= 3) {
          cerrarPoligono()
        }
      } else if (e.key === 'Delete') {
        if (zonaSeleccionada?.geom_wkt) {
          handleBorrar()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers se recrean cada render, deps cubren los valores que leen
  }, [drawMode, drawingCoords, zonaSeleccionada])

  function cerrarPoligono() {
    if (drawingCoords.length < 3) return
    const coords = drawingCoords
    editCoordsRef.current = coords
    setFuente('zona-edit', construirGeojsonDibujo(coords, true))
    vaciarFuente('preview-line')
    setPendingWKT(geometryToWKT({ type: 'Polygon', coordinates: [[...coords, coords[0]]] }))
    setDrawingCoords([])
    setDrawMode('edit')
  }

  function seleccionarZona(zona: Zona) {
    limpiarDibujo()
    setPendingWKT(null)
    setDrawMode('navigate')
    setZonaSeleccionada(zona)
    setNombreEdit(zona.nombre)
    setTipoEdit(zona.tipo)

    const map = mapRef.current
    if (!map) return

    if (zona.geom_wkt) {
      const geom = parseWKT(zona.geom_wkt)
      const centro = getCentroid(geom)
      if (centro) map.flyTo({ center: centro, zoom: 18 })
    } else {
      map.flyTo({ center: getEventoCentro(evento), zoom: 17 })
    }
  }

  async function handleCrearZona() {
    const nombre = nombreNueva.trim()
    if (!nombre) return

    const slug = generarSlugUnico(nombre, zonas.map((z) => z.slug))
    const nueva = await createZona({
      evento_id: evento.id,
      slug,
      nombre,
      tipo: tipoNueva,
    })

    if (nueva) {
      mostrarToast({ msg: `✓ ${nombre} creada`, type: 'success' })
      refetch()
      setTab('sin')
      seleccionarZona(nueva)
      setMostrarFormNueva(false)
      setNombreNueva('')
      setTipoNueva(TIPOS_ZONA[0])
    }
  }

  function handleModoPunto() {
    if (!zonaSeleccionada) return
    limpiarDibujo()
    setPendingWKT(null)
    setDrawMode('point')
  }

  function handleModoPoligono() {
    if (!zonaSeleccionada) return
    limpiarDibujo()
    setPendingWKT(null)
    setDrawMode('polygon')
  }

  function handleModoEditar() {
    if (!zonaSeleccionada) return

    if (editCoordsRef.current.length > 0) {
      setDrawMode('edit')
      return
    }

    if (zonaSeleccionada.geom_wkt) {
      const geom = parseWKT(zonaSeleccionada.geom_wkt)
      if (!geom) return

      const coords =
        geom.type === 'Point'
          ? [geom.coordinates as [number, number]]
          : geom.type === 'Polygon'
            ? (geom.coordinates[0] as [number, number][]).slice(0, -1)
            : null
      if (!coords) return

      editCoordsRef.current = coords
      setFuente('zona-edit', construirGeojsonDibujo(coords, coords.length >= 3))
      setPendingWKT(zonaSeleccionada.geom_wkt)
      setDrawMode('edit')
    }
  }

  async function handleBorrar() {
    if (!zonaSeleccionada?.geom_wkt) return
    if (!confirm(`¿Borrar la geometría de ${zonaSeleccionada.nombre}?`)) return

    const nombre = zonaSeleccionada.nombre
    const ok = await saveGeom(zonaSeleccionada.id, null)
    if (ok) {
      mostrarToast({ msg: `✓ ${nombre} geometría borrada`, type: 'success' })
      refetch()
      limpiarDibujo()
      setPendingWKT(null)
      setDrawMode('navigate')
    }
  }

  async function handleGuardar() {
    if (!zonaSeleccionada || !pendingWKT) return

    const nombre = zonaSeleccionada.nombre
    const ok = await saveGeom(zonaSeleccionada.id, pendingWKT)
    if (ok) {
      mostrarToast({ msg: `✓ ${nombre} guardada`, type: 'success' })
      refetch()
      limpiarDibujo()
      setPendingWKT(null)
      setDrawMode('navigate')
    }
  }

  function handleDescartar() {
    limpiarDibujo()
    setPendingWKT(null)
    setDrawMode('navigate')
  }

  async function handleGuardarInfo() {
    if (!zonaSeleccionada) return
    const nombre = nombreEdit.trim()
    if (!nombre) return

    const ok = await updateZonaInfo(zonaSeleccionada.id, { nombre, tipo: tipoEdit })
    if (ok) {
      mostrarToast({ msg: `✓ ${nombre} actualizada`, type: 'success' })
      setZonaSeleccionada({ ...zonaSeleccionada, nombre, tipo: tipoEdit as ZonaTipo })
      refetch()
    }
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

  const total = zonas.length
  const completadas = zonasConGeom.length
  const porcentaje = total === 0 ? 0 : Math.round((completadas / total) * 100)
  const colorBarra =
    porcentaje > 80 ? 'bg-brand-green' : porcentaje > 50 ? 'bg-brand-gold' : 'bg-red-500'

  const listaActiva = tab === 'sin' ? zonasSinGeom : zonasConGeom
  const puedeEditar = Boolean(pendingWKT || zonaSeleccionada?.geom_wkt)

  const tiposDisponibles =
    tipoEdit && !TIPOS_ZONA.includes(tipoEdit) ? [...TIPOS_ZONA, tipoEdit] : TIPOS_ZONA

  const instrucciones: Record<DrawMode, string> = {
    navigate: 'Seleccioná una zona y un modo para comenzar.',
    point: 'Click en el mapa para posicionar.',
    polygon: 'Click para agregar vértices. Click en el primer punto para cerrar.',
    edit: 'Arrastrá los puntos para ajustar.',
  }

  return (
    <div className="flex h-screen w-full">
      <div className="w-[300px] flex-shrink-0 overflow-y-auto border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-brand-dark">
          <h1 className="text-lg font-semibold text-white">GeoEditor</h1>
          <p className="text-sm text-brand-cream/70 mb-3">{evento.nombre}</p>

          <p className="text-xs text-brand-cream/70 mb-1">
            {completadas} / {total} zonas georeferenciadas
          </p>
          <div className="h-2 w-full rounded-full bg-white/15">
            <div
              className={`h-2 rounded-full ${colorBarra}`}
              style={{ width: `${porcentaje}%` }}
            />
          </div>
        </div>

        <div className="p-3 border-b border-gray-200">
          {!mostrarFormNueva ? (
            <button
              type="button"
              onClick={() => setMostrarFormNueva(true)}
              className="w-full rounded-lg border border-dashed border-brand-green text-brand-green py-2 text-sm hover:bg-brand-green/5"
            >
              + Nueva zona
            </button>
          ) : (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nombre de la nueva zona</label>
              <input
                type="text"
                value={nombreNueva}
                onChange={(e) => setNombreNueva(e.target.value)}
                placeholder="Ej: Manzana 26"
                autoFocus
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm mb-2"
              />

              <label className="block text-xs text-gray-500 mb-1">Tipo</label>
              <select
                value={tipoNueva}
                onChange={(e) => setTipoNueva(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm mb-2"
              >
                {TIPOS_ZONA.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCrearZona}
                  disabled={!nombreNueva.trim() || creatingZona}
                  className="flex-1 rounded-lg bg-brand-green py-1.5 text-sm text-white disabled:opacity-40 hover:bg-brand-dark"
                >
                  {creatingZona ? 'Creando...' : 'Crear'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMostrarFormNueva(false)
                    setNombreNueva('')
                  }}
                  className="flex-1 rounded-lg border border-gray-300 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {zonaSeleccionada && (
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <label className="block text-xs text-gray-500 mb-1">Nombre</label>
            <input
              type="text"
              value={nombreEdit}
              onChange={(e) => setNombreEdit(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm mb-2"
            />

            <label className="block text-xs text-gray-500 mb-1">Tipo</label>
            <select
              value={tipoEdit}
              onChange={(e) => setTipoEdit(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm mb-2"
            >
              {tiposDisponibles.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleGuardarInfo}
              disabled={
                savingInfo ||
                !nombreEdit.trim() ||
                (nombreEdit === zonaSeleccionada.nombre && tipoEdit === zonaSeleccionada.tipo)
              }
              className="w-full rounded-lg bg-brand-green py-1.5 text-sm text-white disabled:opacity-40 hover:bg-brand-dark"
            >
              {savingInfo ? 'Guardando...' : 'Guardar nombre / tipo'}
            </button>
          </div>
        )}

        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => setTab('sin')}
            className={`flex-1 py-2 text-sm border-b-2 ${
              tab === 'sin' ? 'border-brand-gold text-brand-dark' : 'border-transparent text-gray-500'
            }`}
          >
            Sin posición ({zonasSinGeom.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('completadas')}
            className={`flex-1 py-2 text-sm border-b-2 ${
              tab === 'completadas'
                ? 'border-brand-green text-brand-dark'
                : 'border-transparent text-gray-500'
            }`}
          >
            Completadas ({zonasConGeom.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {listaActiva.map((zona) => (
            <button
              key={zona.id}
              type="button"
              onClick={() => seleccionarZona(zona)}
              className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left border-b border-gray-100 ${
                zonaSeleccionada?.id === zona.id ? 'bg-brand-cream' : 'hover:bg-gray-50'
              }`}
            >
              <div>
                <p className="text-sm font-medium text-brand-dark">
                  {getIconoZona(zona.tipo)} {zona.nombre}
                </p>
                <span
                  className="inline-block text-[10px] px-1.5 py-0.5 rounded-full mt-1"
                  style={{
                    backgroundColor: getColorZona(zona.tipo).fill,
                    color: getColorZona(zona.tipo).stroke,
                  }}
                >
                  {zona.tipo}
                </span>
              </div>

              {zona.geom_wkt ? (
                <span className="text-brand-green text-sm">✓</span>
              ) : (
                <span className="text-gray-300 text-sm">●</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-3">{instrucciones[drawMode]}</p>

          {(drawMode === 'point' || drawMode === 'polygon') && cursorCoords && (
            <p className="text-xs text-gray-400 mb-3 font-mono">
              Lat: {cursorCoords.lat.toFixed(4)}  Lon: {cursorCoords.lon.toFixed(4)}
            </p>
          )}

          {drawMode === 'polygon' && drawingCoords.length >= 3 && (
            <button
              type="button"
              onClick={cerrarPoligono}
              className="w-full mb-2 rounded-lg border border-brand-gold text-brand-gold py-2 text-sm hover:bg-brand-gold/10"
            >
              Cerrar polígono
            </button>
          )}

          {saveError && <p className="text-xs text-red-600 mb-2">{saveError.message}</p>}

          <button
            type="button"
            onClick={handleGuardar}
            disabled={!pendingWKT || saving}
            className="w-full mb-2 rounded-lg bg-brand-green py-2 text-sm text-white disabled:opacity-40 hover:bg-brand-dark"
          >
            {saving ? 'Guardando...' : 'Guardar posición'}
          </button>
          <button
            type="button"
            onClick={handleDescartar}
            className="w-full rounded-lg border border-gray-300 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Descartar
          </button>
        </div>
      </div>

      <div className="relative flex-1">
        <div ref={mapContainerRef} className="h-screen w-full" />

        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <button
            type="button"
            disabled={!zonaSeleccionada}
            onClick={handleModoPunto}
            className={`rounded-lg px-3 py-2 text-sm shadow-md disabled:opacity-40 ${
              drawMode === 'point' ? 'bg-brand-green text-white' : 'bg-white text-brand-dark'
            }`}
          >
            📍 Punto
          </button>
          <button
            type="button"
            disabled={!zonaSeleccionada}
            onClick={handleModoPoligono}
            className={`rounded-lg px-3 py-2 text-sm shadow-md disabled:opacity-40 ${
              drawMode === 'polygon' ? 'bg-brand-green text-white' : 'bg-white text-brand-dark'
            }`}
          >
            ⬡ Polígono
          </button>
          <button
            type="button"
            disabled={!zonaSeleccionada || !puedeEditar}
            onClick={handleModoEditar}
            className={`rounded-lg px-3 py-2 text-sm shadow-md disabled:opacity-40 ${
              drawMode === 'edit' ? 'bg-brand-green text-white' : 'bg-white text-brand-dark'
            }`}
          >
            ✏️ Editar
          </button>
          <button
            type="button"
            disabled={!zonaSeleccionada?.geom_wkt}
            onClick={handleBorrar}
            className="rounded-lg bg-white px-3 py-2 text-sm text-brand-dark shadow-md disabled:opacity-40"
          >
            🗑️ Borrar
          </button>
        </div>

        {planoCargado && (
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-md">
            <span className="text-xs text-gray-500">Plano: {Math.round(planoOpacity * 100)}%</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={planoOpacity}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                setPlanoOpacity(v)
                if (mapRef.current?.getLayer('plano-layer')) {
                  mapRef.current.setPaintProperty('plano-layer', 'raster-opacity', v)
                }
              }}
              style={{ width: 100 }}
            />
          </div>
        )}

        <div className="absolute bottom-6 right-6 z-10 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleResetView}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md"
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
            onClick={() => mapRef.current?.zoomIn()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md text-lg text-brand-dark"
            aria-label="Acercar"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => mapRef.current?.zoomOut()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md text-lg text-brand-dark"
            aria-label="Alejar"
          >
            −
          </button>
        </div>
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${
            toast.type === 'success' ? 'bg-brand-green' : 'bg-red-600'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}
