import { useParams, Link } from 'react-router-dom'
import { useEvento } from '../hooks/useEvento'
import GeoEditor from '../components/GeoEditor'

export default function GeoEditorPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const { evento, loading } = useEvento(slug)

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-brand-green rounded-full animate-spin" />
      </div>
    )
  }

  if (!evento) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Evento no encontrado</p>
          <Link to="/" className="text-brand-green text-sm">
            Ver todos los eventos
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen overflow-hidden">
      <GeoEditor evento={evento} />
    </div>
  )
}
