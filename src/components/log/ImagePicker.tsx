import { useEffect, useRef, useState } from 'react'
import { Camera, MessageSquare, Upload, Send } from 'lucide-react'

export type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp'

interface ImagePickerProps {
  onImage: (base64: string, mimeType: ImageMimeType) => void
  onPrompt: (prompt: string) => void
}

function compressImage(file: File): Promise<{ base64: string; mimeType: ImageMimeType }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result
      if (typeof result !== 'string') {
        reject(new Error('Failed to read image as data URL'))
        return
      }
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_SIZE = 800
        let { width, height } = img

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width)
            width = MAX_SIZE
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height)
            height = MAX_SIZE
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)

        const dataUrl = canvas.toDataURL('image/webp', 0.75)
        const base64 = dataUrl.split(',')[1] ?? ''
        resolve({ base64, mimeType: 'image/webp' })
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = result
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export default function ImagePicker({ onImage, onPrompt }: ImagePickerProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [promptText, setPromptText] = useState('')
  const [mode, setMode] = useState<'photo' | 'text'>('photo')

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const handleFile = async (file: File) => {
    if (!file) return
    setFileError(null)

    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    if (file.size > MAX_FILE_SIZE) {
      setFileError('Image is too large. Please choose a photo under 10MB.')
      return
    }

    setIsProcessing(true)
    try {
      const { base64, mimeType } = await compressImage(file)
      if (preview) URL.revokeObjectURL(preview)
      const previewUrl = URL.createObjectURL(file)
      setPreview(previewUrl)
      onImage(base64, mimeType)
    } catch (err) {
      console.error('Failed to process image:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
  }

  if (preview) {
    return (
      <div className="rise-in flex flex-col items-center gap-4">
        <div className="island-shell w-full max-w-sm overflow-hidden rounded-2xl">
          <img
            src={preview}
            alt="Selected food"
            className="h-64 w-full object-cover"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setPreview(null)
            if (cameraInputRef.current) cameraInputRef.current.value = ''
            if (uploadInputRef.current) uploadInputRef.current.value = ''
          }}
          className="rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-2 text-sm font-medium text-[var(--sea-ink-soft)] transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
        >
          Re-take / Change
        </button>
      </div>
    )
  }

  const handlePromptSubmit = () => {
    const trimmed = promptText.trim()
    if (!trimmed) return
    onPrompt(trimmed)
  }

  return (
    <div className="rise-in flex flex-col items-center gap-6 py-4">
      {/* Mode toggle */}
      <div className="flex w-full max-w-sm rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] p-1">
        <button
          type="button"
          onClick={() => setMode('photo')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
            mode === 'photo'
              ? 'bg-[var(--lagoon-deep)] text-white shadow-sm'
              : 'text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]'
          }`}
        >
          <Camera size={16} />
          Photo
        </button>
        <button
          type="button"
          onClick={() => setMode('text')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
            mode === 'text'
              ? 'bg-[var(--lagoon-deep)] text-white shadow-sm'
              : 'text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]'
          }`}
        >
          <MessageSquare size={16} />
          Describe
        </button>
      </div>

      {mode === 'photo' ? (
        <>
          {fileError && (
        <div role="alert" className="w-full max-w-sm rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {fileError}
        </div>
      )}

      <div className="island-shell flex h-40 w-full max-w-sm flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--lagoon-deep)] p-6 text-center opacity-60">
            <Camera size={40} strokeWidth={1.5} className="text-[var(--lagoon-deep)]" />
            <p className="text-sm text-[var(--sea-ink-soft)]">Take or upload a photo of your meal</p>
          </div>

          <div className="flex w-full max-w-sm gap-3">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => cameraInputRef.current?.click()}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--lagoon-deep)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              <Camera size={18} />
              Take Photo
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => uploadInputRef.current?.click()}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--lagoon-deep)] bg-transparent px-4 py-3 text-sm font-semibold text-[var(--lagoon-deep)] transition hover:bg-[rgba(79,184,178,0.08)] disabled:opacity-60"
            >
              <Upload size={18} />
              Upload
            </button>
          </div>
        </>
      ) : (
        <div className="w-full max-w-sm space-y-3">
          <div className="island-shell rounded-2xl p-4">
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Describe what you ate, e.g.&#10;&#10;A bowl of rice with grilled chicken, steamed broccoli, and a fried egg"
              rows={4}
              maxLength={500}
              className="w-full resize-none rounded-lg border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-2.5 text-base text-[var(--sea-ink)] outline-none placeholder:text-[var(--sea-ink-soft)] focus:border-[var(--lagoon-deep)] focus:ring-2 focus:ring-[var(--lagoon-deep)]/20"
            />
            <div className="mt-1 text-right text-xs text-[var(--sea-ink-soft)]">
              {promptText.length}/500
            </div>
          </div>

          <button
            type="button"
            disabled={!promptText.trim()}
            onClick={handlePromptSubmit}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--lagoon-deep)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            <Send size={18} />
            Analyze Meal
          </button>

          <p className="text-center text-xs text-[var(--sea-ink-soft)]">
            Only food-related descriptions are accepted
          </p>
        </div>
      )}

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
