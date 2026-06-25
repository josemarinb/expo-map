import { useParams, Link } from 'react-router-dom'
import { useEvento, useZonas } from '../hooks/useEvento'
import MapViewer from '../components/MapViewer'

export default function MapaPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const { evento, loading: loadingEvento } = useEvento(slug)
  const { zonas } = useZonas(evento?.id ?? null)

  if (loadingEvento) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-brand-green rounded-full animate-spin" />
      </div>
    )
  }

  if (!evento) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Evento no encontrado</p>
          <Link to="/" className="text-brand-green text-sm">
            Ver todos los eventos
          </Link>
        </div>
      </div>
    )
  }

  return <MapViewer evento={evento} zonas={zonas} />
}
