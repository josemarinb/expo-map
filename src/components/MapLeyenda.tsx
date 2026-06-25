import { useState } from 'react'
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
  const [abierta, setAbierta] = useState(true)
  const tipos = Object.keys(ZONA_COLORES) as ZonaTipo[]

  if (!abierta) {
    return (
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className="rounded-full bg-white px-3 py-2 text-xs font-medium text-brand-dark shadow-md"
      >
        Leyenda
      </button>
    )
  }

  return (
    <div className="w-[160px] max-h-[55vh] overflow-y-auto rounded-lg bg-white p-3 shadow-md">
      <button
        type="button"
        onClick={() => setAbierta(false)}
        className="mb-1 flex w-full items-center justify-between text-xs font-semibold text-brand-dark"
      >
        <span>Leyenda</span>
        <span>✕</span>
      </button>

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
