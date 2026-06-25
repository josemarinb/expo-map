export type EventoTipo =
  | 'expo' | 'feria' | 'shopping'
  | 'estadio' | 'aeropuerto' | 'campus' | 'otro'

export type ZonaTipo =
  | 'pabellon' | 'salon' | 'area_servicios'
  | 'estacionamiento' | 'parque' | 'deposito' | 'otro'

export interface Evento {
  id: string
  slug: string
  nombre: string
  tipo: EventoTipo
  fecha_inicio: string | null
  fecha_fin: string | null
  activo: boolean
  metadata: {
    plano_bounds?: [number, number, number, number] // [oeste, sur, este, norte]
    plano_imagen_url?: string
    imagen_corners?: [
      [number, number],
      [number, number],
      [number, number],
      [number, number],
    ] // [[oeste,norte],[este,norte],[este,sur],[oeste,sur]]
    centro?: [number, number]
    zoom_inicial?: number
    calles?: string[]
    notas?: string
  } | null
}

export interface Zona {
  id: string
  evento_id: string
  slug: string
  nombre: string
  tipo: ZonaTipo
  descripcion: string | null
  foto_url: string | null
  icono: string
  horario_apertura: string | null  // "08:00"
  horario_cierre: string | null    // "18:00"
  categoria: string | null
  capacidad_vehiculos: number | null
  visible: boolean
  color_fill: string | null
  color_stroke: string | null
  geom_wkt: string | null  // "POINT(-57.63 -25.29)" o "POLYGON(...)"
}

export interface Acceso {
  id: string
  evento_id: string
  zona_id: string | null
  nombre: string
  altura_porton_m: number | null
}

export interface Capa {
  id: string
  evento_id: string
  nombre: string
  tipo: string
  color_fill: string
  color_stroke: string
  visible: boolean
  orden: number
}

// Paleta de marca: verde-oscuro #16382B, verde-medio #2E7D32, dorado #C0892C, crema #F7F4EC.
// Cada tipo usa una variación tonal de esa paleta (más un par de acentos tierra) para
// mantener la identidad visual sin perder la distinción entre categorías en el mapa.
export const ZONA_COLORES: Record<ZonaTipo, { fill: string; stroke: string }> = {
  pabellon:        { fill: '#EAF3EC', stroke: '#2E7D32' }, // verde-medio
  salon:           { fill: '#F5EFE3', stroke: '#C0892C' }, // dorado
  area_servicios:  { fill: '#E9F0EE', stroke: '#16382B' }, // verde-oscuro
  estacionamiento: { fill: '#F2EFE9', stroke: '#8C7A5B' }, // bronce neutro
  parque:          { fill: '#EEF3E3', stroke: '#6B8E4E' }, // verde oliva
  deposito:        { fill: '#F7F0E1', stroke: '#A66A2E' }, // terracota
  otro:            { fill: '#F7F4EC', stroke: '#6B6457' }, // crema / gris cálido
}

// Íconos por tipo de zona (para etiquetas en el mapa, legibles también en mobile)
export const ZONA_ICONOS: Record<ZonaTipo, string> = {
  pabellon: '🏛️',
  salon: '🏢',
  area_servicios: '🚻',
  estacionamiento: '🅿️',
  parque: '🌳',
  deposito: '📦',
  otro: '📍',
}

// Helpers con fallback seguro para tipos fuera del enum (ej. "acceso", datos legados)
export function getColorZona(tipo: string): { fill: string; stroke: string } {
  return ZONA_COLORES[tipo as ZonaTipo] ?? ZONA_COLORES.otro
}

export function getIconoZona(tipo: string): string {
  if (tipo === 'acceso') return '🚪'
  return ZONA_ICONOS[tipo as ZonaTipo] ?? ZONA_ICONOS.otro
}

// Id estable para registrar/buscar el ícono como imagen en MapLibre (ver src/lib/iconos.ts).
// Distinto de getIconoZona: ese devuelve el emoji para texto DOM normal (sí soporta color),
// este devuelve la clave de la imagen ya registrada vía map.addImage (necesario porque
// MapLibre renderiza text-field con fuentes SDF sin color, no con emoji reales).
export function getIconoIdZona(tipo: string): string {
  if (tipo === 'acceso') return 'acceso'
  return (tipo as ZonaTipo) in ZONA_ICONOS ? tipo : 'otro'
}

export const TODOS_LOS_ICONOS: Record<string, string> = {
  ...ZONA_ICONOS,
  acceso: '🚪',
}
