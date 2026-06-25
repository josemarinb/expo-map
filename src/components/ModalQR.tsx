import { useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import type { Evento } from '../types/map'

interface ModalQRProps {
  evento: Evento
  onClose: () => void
}

export default function ModalQR({ evento, onClose }: ModalQRProps) {
  const qrContainerRef = useRef<HTMLDivElement>(null)
  const url = `${window.location.origin}/mapa/${evento.slug}`

  function handleDescargar() {
    const canvas = qrContainerRef.current?.querySelector('canvas')
    if (!canvas) return

    const dataUrl = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `qr-${evento.slug}.png`
    a.click()
  }

  async function handleCopiarLink() {
    await navigator.clipboard.writeText(url)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative w-[320px] rounded-xl bg-white p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          aria-label="Cerrar"
        >
          ✕
        </button>

        <div id="qr-canvas" ref={qrContainerRef} className="flex justify-center my-4">
          <QRCodeCanvas value={url} size={200} />
        </div>

        <p className="text-sm font-medium text-brand-dark mb-4">{evento.nombre}</p>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleDescargar}
            className="w-full rounded-lg bg-brand-green py-2 text-sm text-white hover:bg-brand-dark"
          >
            Descargar PNG
          </button>
          <button
            type="button"
            onClick={handleCopiarLink}
            className="w-full rounded-lg border border-brand-gold text-brand-gold py-2 text-sm hover:bg-brand-gold/10"
          >
            Copiar link
          </button>
        </div>
      </div>
    </div>
  )
}
