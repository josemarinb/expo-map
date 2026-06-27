import type { RouteResult } from '../lib/routing'
import { PANEL_CLASES } from './panelStyles'

interface RoutePanelProps {
  route: RouteResult
  onClose: () => void
}

export default function RoutePanel({ route, onClose }: RoutePanelProps) {
  const distanciaTexto =
    route.distanceM < 500
      ? `${route.distanceM} m`
      : `${(route.distanceM / 1000).toFixed(1)} km`
  const minutos = Math.ceil(route.durationS / 60)
  const pasos = route.steps.filter((paso) => paso.distanceM > 0).slice(0, 6)

  return (
    <div className={PANEL_CLASES}>
      <div className="flex justify-center pt-2 pb-1 md:hidden">
        <div className="h-1.5 w-10 rounded-full bg-gray-300" />
      </div>

      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-5 w-5 text-brand-green"
          >
            <path d="M3 11l18-8-8 18-2-8-8-2z" />
          </svg>
          <h2 className="text-base font-medium text-brand-dark">Cómo llegar</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          aria-label="Cancelar ruta"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 p-4">
        <div className="rounded-lg bg-brand-cream p-3 text-center">
          <p className="text-lg font-semibold text-brand-dark">{distanciaTexto}</p>
          <p className="text-xs text-gray-500">Distancia</p>
        </div>
        <div className="rounded-lg bg-brand-cream p-3 text-center">
          <p className="text-lg font-semibold text-brand-dark">{minutos} min</p>
          <p className="text-xs text-gray-500">Caminando</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        {pasos.map((paso, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-green text-xs font-semibold text-white">
              {idx + 1}
            </span>
            <div>
              <p className="text-sm text-brand-dark">{paso.instruction}</p>
              <p className="text-xs text-gray-500">
                {paso.streetName} · {paso.distanceM} m
              </p>
            </div>
          </div>
        ))}
      </div>

      <div
        className="p-4 border-t border-gray-200"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <p className="text-xs text-center text-gray-500">
          Seguí la línea azul en el mapa
        </p>
      </div>
    </div>
  )
}
