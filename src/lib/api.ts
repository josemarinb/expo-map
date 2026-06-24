import { supabase } from './supabase'
import type { Evento, Zona, Acceso } from '../types/map'

export async function getEvento(slug: string): Promise<Evento | null> {
  const { data, error } = await supabase
    .from('eventos')
    .select('*')
    .eq('slug', slug)
    .eq('activo', true)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // not found
    throw error
  }
  return data as Evento
}

export async function getZonasByEvento(eventoId: string): Promise<Zona[]> {
  const { data, error } = await supabase
    .from('zonas')
    .select('*')
    .eq('evento_id', eventoId)
    .eq('visible', true)
    .order('nombre')

  if (error) throw error
  return (data ?? []) as Zona[]
}

export async function getAccesosByEvento(eventoId: string): Promise<Acceso[]> {
  const { data, error } = await supabase
    .from('accesos')
    .select('*')
    .eq('evento_id', eventoId)
    .eq('activo', true)

  if (error) throw error
  return (data ?? []) as Acceso[]
}

export async function updateZona(
  id: string,
  updates: Partial<Omit<Zona, 'id' | 'evento_id'>>
): Promise<Zona> {
  const { data, error } = await supabase
    .from('zonas')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Zona
}

export async function buscarZona(
  eventoId: string,
  query: string
): Promise<Array<{ id: string; nombre: string; tipo: string; similitud: number }>> {
  const { data, error } = await supabase.rpc('buscar_zona', {
    p_evento_id: eventoId,
    p_query: query,
  })

  if (error) throw error
  return data ?? []
}
