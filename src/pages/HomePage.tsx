import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEventos } from '../hooks/useEvento'
import ModalQR from '../components/ModalQR'
import type { Evento } from '../types/map'

function formatFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-PY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <div className="h-5 w-2/3 rounded bg-gray-200 animate-pulse mb-3" />
      <div className="h-4 w-1/3 rounded bg-gray-200 animate-pulse mb-4" />
      <div className="h-4 w-1/2 rounded bg-gray-200 animate-pulse mb-6" />
      <div className="flex gap-2">
        <div className="h-9 flex-1 rounded-lg bg-gray-200 animate-pulse" />
        <div className="h-9 flex-1 rounded-lg bg-gray-200 animate-pulse" />
      </div>
    </div>
  )
}

function EventoCard({
  evento,
  onVerQR,
}: {
  evento: Evento
  onVerQR: (evento: Evento) => void
}) {
  const navigate = useNavigate()

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <h2 className="text-lg font-medium text-gray-900 mb-2">{evento.nombre}</h2>

      <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 mb-3">
        {evento.tipo}
      </span>

      {(evento.fecha_inicio || evento.fecha_fin) && (
        <p className="text-sm text-gray-500 mb-4">
          {evento.fecha_inicio && formatFecha(evento.fecha_inicio)}
          {evento.fecha_inicio && evento.fecha_fin && ' – '}
          {evento.fecha_fin && formatFecha(evento.fecha_fin)}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => navigate(`/mapa/${evento.slug}`)}
          className="flex-1 rounded-lg bg-blue-600 py-2 text-sm text-white hover:bg-blue-700"
        >
          Ver mapa
        </button>
        <button
          type="button"
          onClick={() => navigate(`/admin/${evento.slug}/georef`)}
          className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Editar mapa
        </button>
        <button
          type="button"
          onClick={() => onVerQR(evento)}
          className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Ver QR
        </button>
      </div>
    </div>
  )
}

export default function HomePage() {
  const { eventos, loading } = useEventos()
  const [eventoQR, setEventoQR] = useState<Evento | null>(null)

  return (
    <div className="min-h-screen">
      <header className="text-center pt-10 pb-6">
        <p className="text-xl font-semibold text-gray-900">MapasExp</p>
        <p className="text-sm text-gray-500">Navegación inteligente para eventos</p>
      </header>

      <main className="mx-auto max-w-[800px] px-8">
        {loading && (
          <div className="grid gap-4 sm:grid-cols-2">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {!loading && eventos.length === 0 && (
          <p className="text-center text-gray-500">No hay eventos disponibles</p>
        )}

        {!loading && eventos.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {eventos.map((evento) => (
              <EventoCard key={evento.id} evento={evento} onVerQR={setEventoQR} />
            ))}
          </div>
        )}
      </main>

      {eventoQR && <ModalQR evento={eventoQR} onClose={() => setEventoQR(null)} />}
    </div>
  )
}
