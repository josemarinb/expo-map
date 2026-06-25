import type maplibregl from 'maplibre-gl'

const TAMANIO_BASE = 48

function crearIconoImageData(emoji: string): ImageData {
  const dpr = window.devicePixelRatio || 1
  const size = TAMANIO_BASE * dpr

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.font = `${size * 0.7}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(emoji, size / 2, size / 2 + size * 0.05)
    return ctx.getImageData(0, 0, size, size)
  }

  return new ImageData(size, size)
}

export function registrarIconoZona(map: maplibregl.Map, id: string, emoji: string) {
  if (map.hasImage(id)) return
  const imageData = crearIconoImageData(emoji)
  map.addImage(id, imageData, { pixelRatio: window.devicePixelRatio || 1 })
}
