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

// Colores por tipo de zona (para el mapa)
export const ZONA_COLORES: Record<ZonaTipo, { fill: string; stroke: string }> = {
  pabellon:        { fill: '#EBF4FF', stroke: '#378ADD' },
  salon:           { fill: '#F3F0FF', stroke: '#7F77DD' },
  area_servicios:  { fill: '#EDFAF4', stroke: '#1D9E75' },
  estacionamiento: { fill: '#F1EFE8', stroke: '#888780' },
  parque:          { fill: '#EAF3DE', stroke: '#639922' },
  deposito:        { fill: '#FEF3DC', stroke: '#BA7517' },
  otro:            { fill: '#F1EFE8', stroke: '#B4B2A9' },
}
