// Panel lateral en desktop, hoja deslizable desde abajo en mobile: así nunca
// tapa el mapa entero en pantallas angostas. Compartido por PanelInfo (en
// MapViewer.tsx) y RoutePanel para que ambos se comporten igual.
export const PANEL_CLASES =
  'fixed inset-x-0 bottom-0 z-30 flex flex-col max-h-[70vh] overflow-hidden ' +
  'rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] bg-white ' +
  'md:static md:inset-auto md:z-20 md:h-dvh md:max-h-none md:w-[280px] ' +
  'md:rounded-none md:border-l md:border-gray-200 md:shadow-none'
