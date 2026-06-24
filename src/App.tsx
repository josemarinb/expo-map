import { BrowserRouter, Routes, Route } from 'react-router-dom'
import 'maplibre-gl/dist/maplibre-gl.css'
import HomePage from './pages/HomePage'
import MapaPage from './pages/MapaPage'
import GeoEditorPage from './pages/GeoEditorPage'

function AdminPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Admin — próxima fase</p>
    </div>
  )
}

function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-4xl font-medium text-gray-300 mb-3">404</p>
        <p className="text-gray-500">Página no encontrada</p>
        <a href="/" className="text-blue-600 text-sm mt-4 inline-block">
          Volver al inicio
        </a>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/mapa/:slug" element={<MapaPage />} />
        <Route path="/admin/:slug" element={<AdminPage />} />
        <Route path="/admin/:slug/georef" element={<GeoEditorPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
