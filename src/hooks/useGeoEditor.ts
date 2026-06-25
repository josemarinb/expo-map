import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Zona } from '../types/map'

export function useZonasGeoEditor(eventoId: string) {
  const [zonas, setZonas] = useState<Zona[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [refetchTick, setRefetchTick] = useState(0)

  useEffect(() => {
    if (!eventoId) return

    let cancelado = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag para el fetch que sigue
    setLoading(true)
    setError(null)

    Promise.resolve(
      supabase
        .from('zonas')
        .select('*')
        .eq('evento_id', eventoId)
        .order('nombre', { ascending: true })
    )
      .then(({ data, error: supabaseError }) => {
        if (cancelado) return

        if (supabaseError) {
          setError(new Error(supabaseError.message))
          return
        }

        setZonas((data ?? []) as Zona[])
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })

    return () => {
      cancelado = true
    }
  }, [eventoId, refetchTick])

  const refetch = useCallback(() => {
    setRefetchTick((tick) => tick + 1)
  }, [])

  const zonasConGeom = zonas.filter((z) => z.geom_wkt !== null)
  const zonasSinGeom = zonas.filter((z) => z.geom_wkt === null)

  return { zonas, zonasConGeom, zonasSinGeom, loading, error, refetch }
}

export function useSaveGeom() {
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const saveGeom = useCallback(async (zonaId: string, wkt: string | null): Promise<boolean> => {
    setSaving(true)
    setError(null)

    const { error: rpcError } =
      wkt === null
        ? await supabase.rpc('delete_zona_geom', { zona_id: zonaId })
        : await supabase.rpc('update_zona_geom', { zona_id: zonaId, wkt_text: wkt })

    if (rpcError) {
      setError(new Error(rpcError.message))
      setSaving(false)
      return false
    }

    const { data, error: selectError } = await supabase
      .from('zonas')
      .select('slug')
      .eq('id', zonaId)
      .single()

    if (selectError) {
      setError(new Error(selectError.message))
      setSaving(false)
      return false
    }

    setLastSaved((data as { slug: string }).slug)
    setSaving(false)
    return true
  }, [])

  return { saving, lastSaved, error, saveGeom }
}

export function useUpdateZonaInfo() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const updateZonaInfo = useCallback(
    async (zonaId: string, cambios: { nombre: string; tipo: string }): Promise<boolean> => {
      setSaving(true)
      setError(null)

      const { error: updateError } = await supabase
        .from('zonas')
        .update({ nombre: cambios.nombre, tipo: cambios.tipo })
        .eq('id', zonaId)

      setSaving(false)

      if (updateError) {
        setError(new Error(updateError.message))
        return false
      }

      return true
    },
    []
  )

  return { saving, error, updateZonaInfo }
}
