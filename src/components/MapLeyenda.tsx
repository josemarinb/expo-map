import { ZONA_COLORES, ZONA_ICONOS } from '../types/map'
import type { ZonaTipo } from '../types/map'

interface MapLeyendaProps {
  capasVisibles: Record<string, boolean>
  onToggle: (tipo: string) => void
}

const NOMBRES_TIPO: Record<ZonaTipo, string> = {
  pabellon: 'Pabellones',
  salon: 'Salones',
  area_servicios: 'Servicios',
  estacionamiento: 'Estacionamiento',
  parque: 'Parque',
  deposito: 'Depósitos',
  otro: 'Otros',
}

export default function MapLeyenda({ capasVisibles, onToggle }: MapLeyendaProps) {
  const tipos = Object.keys(ZONA_COLORES) as ZonaTipo[]

  return (
    <div className="w-[160px] rounded-lg bg-white p-3 shadow-md">
      {tipos.map((tipo) => {
        const visible = capasVisibles[tipo] ?? true
        return (
          <button
            key={tipo}
            type="button"
            onClick={() => onToggle(tipo)}
            className="flex w-full items-center gap-2 py-1 text-left cursor-pointer"
          >
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: ZONA_COLORES[tipo].stroke }}
            />
            <span
              className="text-xs text-brand-dark"
              style={{ opacity: visible ? 1 : 0.4 }}
            >
              {ZONA_ICONOS[tipo]} {NOMBRES_TIPO[tipo]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
