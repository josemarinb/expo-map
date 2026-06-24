import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Evento, Zona } from '../types/map'

export function useEvento(slug: string) {
  const [evento, setEvento] = useState<Evento | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!slug) return

    let cancelado = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag para el fetch que sigue
    setLoading(true)
    setError(null)

    Promise.resolve(
      supabase
        .from('eventos')
        .select('*')
        .eq('slug', slug)
        .eq('activo', true)
        .single()
    )
      .then(({ data, error: supabaseError }) => {
        if (cancelado) return

        if (supabaseError) {
          if (supabaseError.code === 'PGRST116') {
            setEvento(null)
          } else {
            setError(new Error(supabaseError.message))
          }
          return
        }

        setEvento(data as Evento)
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })

    return () => {
      cancelado = true
    }
  }, [slug])

  return { evento, loading, error }
}

export function useEventos() {
  const [eventos, setEventos] = useState<Evento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelado = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag para el fetch que sigue
    setLoading(true)
    setError(null)

    Promise.resolve(
      supabase
        .from('eventos')
        .select('*')
        .eq('activo', true)
        .order('creado_en', { ascending: false })
    )
      .then(({ data, error: supabaseError }) => {
        if (cancelado) return

        if (supabaseError) {
          setError(new Error(supabaseError.message))
          return
        }

        setEventos((data ?? []) as Evento[])
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })

    return () => {
      cancelado = true
    }
  }, [])

  return { eventos, loading, error }
}

export function useZonas(eventoId: string | null) {
  const [zonas, setZonas] = useState<Zona[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

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
        .eq('visible', true)
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
  }, [eventoId])

  return { zonas, loading, error }
}
