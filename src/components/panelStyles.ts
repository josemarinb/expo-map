// Panel lateral en desktop, hoja deslizable desde abajo en mobile: así nunca
// tapa el mapa entero en pantallas angostas. Compartido por PanelInfo (en
// MapViewer.tsx) y RoutePanel para que ambos se comporten igual.
//
// `expandido` solo afecta el alto máximo en mobile (en desktop siempre es el
// sidebar fijo de 280px): colapsado deja ver casi todo el mapa, expandido
// muestra el detalle completo con scroll interno.
export function panelClases(expandido: boolean): string {
  const base =
    'fixed inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden ' +
    'rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] bg-white ' +
    'transition-[max-height] duration-300 ease-out ' +
    'md:static md:inset-auto md:z-20 md:h-dvh md:max-h-none md:w-[280px] ' +
    'md:rounded-none md:border-l md:border-gray-200 md:shadow-none'

  return `${base} ${expandido ? 'max-h-[70vh]' : 'max-h-[220px]'}`
}
