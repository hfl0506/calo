import { useEffect, useRef, useState } from 'react'
import { scanBarcodeFn, lookupBarcodeFn } from '#/lib/server/barcode'
import type { AnalyzedFood } from '#/lib/types'
import type { ImageMimeType } from '#/components/log/ImagePicker'
import { generateId } from '#/lib/uuid'
import { Camera, Upload, ScanBarcode, Loader2, Keyboard } from 'lucide-react'

interface BarcodeScannerProps {
  onResult: (food: AnalyzedFood) => void
  onError: (error: string) => void
}

function compressBarcodeImage(file: File): Promise<{ base64: string; mimeType: ImageMimeType }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result
      if (typeof result !== 'string') {
        reject(new Error('Failed to read image'))
        return
      }
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_SIZE = 800
        let { width, height } = img
        if (width > height) {
          if (width > MAX_SIZE) { height = Math.round((height * MAX_SIZE) / width); width = MAX_SIZE }
        } else {
          if (height > MAX_SIZE) { width = Math.round((width * MAX_SIZE) / height); height = MAX_SIZE }
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Failed to get canvas context')); return }
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/webp', 0.75)
        resolve({ base64: dataUrl.split(',')[1] ?? '', mimeType: 'image/webp' })
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = result
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export default function BarcodeScanner({ onResult, onError }: BarcodeScannerProps) {
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [manualCode, setManualCode] = useState('')
  const [showManual, setShowManual] = useState(false)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview) }
  }, [preview])

  const handleFile = async (file: File) => {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      onError('Image is too large. Please choose a photo under 10MB.')
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setPreview(previewUrl)
    setLoading(true)

    try {
      const { base64, mimeType } = await compressBarcodeImage(file)
      const { food } = await scanBarcodeFn({ data: { imageBase64: base64, mimeType } })
      navigator.vibrate?.(50)
      onResult({ ...food, id: generateId() })
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No barcode detected. Make sure the barcode is clearly visible.')
    } finally {
      if (preview) URL.revokeObjectURL(preview)
      setPreview(null)
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
    e.target.value = ''
  }

  const handleManualSubmit = async () => {
    const code = manualCode.trim()
    if (!code) return
    setLoading(true)
    try {
      const { food } = await lookupBarcodeFn({ data: { barcode: code } })
      onResult({ ...food, id: generateId() })
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to look up barcode')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-4 py-8">
        {preview && (
          <div className="w-full overflow-hidden rounded-2xl">
            <img src={preview} alt="Barcode photo" className="h-48 w-full object-cover" />
          </div>
        )}
        <Loader2 size={40} className="animate-spin text-[var(--lagoon-deep)]" />
        <p className="text-sm text-[var(--sea-ink-soft)]">Reading barcode…</p>
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4">
      <div className="island-shell flex h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--lagoon-deep)] p-6 text-center opacity-60">
        <ScanBarcode size={40} strokeWidth={1.5} className="text-[var(--lagoon-deep)]" />
        <p className="text-sm text-[var(--sea-ink-soft)]">Take a photo of a barcode to look up nutrition info</p>
      </div>

      <div className="flex w-full gap-3">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--lagoon-deep)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <Camera size={18} />
          Take Photo
        </button>

        <button
          type="button"
          onClick={() => uploadInputRef.current?.click()}
          className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--lagoon-deep)] bg-transparent px-4 py-3 text-sm font-semibold text-[var(--lagoon-deep)] transition hover:bg-[rgba(79,184,178,0.08)]"
        >
          <Upload size={18} />
          Upload
        </button>
      </div>

      <button
        type="button"
        onClick={() => setShowManual((v) => !v)}
        className="flex items-center gap-1.5 text-sm text-[var(--sea-ink-soft)] transition hover:text-[var(--sea-ink)]"
      >
        <Keyboard size={14} />
        Enter barcode manually
      </button>

      {showManual && (
        <div className="flex w-full items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Enter barcode number"
            className="flex-1 rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-2 text-base text-[var(--sea-ink)] outline-none transition focus:border-[var(--lagoon-deep)] placeholder:text-[var(--sea-ink-soft)]"
          />
          <button
            type="button"
            disabled={!manualCode.trim()}
            onClick={() => void handleManualSubmit()}
            className="rounded-xl bg-[var(--lagoon-deep)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
          >
            Look up
          </button>
        </div>
      )}

      <p className="text-center text-xs text-[var(--sea-ink-soft)]">
        Nutrition data from Open Food Facts (per 100g)
      </p>

      {/* Hidden camera input */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Hidden upload input */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  )
}
