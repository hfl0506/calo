import { useRef, useState } from 'react'

interface ImagePickerProps {
  onImage: (base64: string, mimeType: string) => void
  onPrompt: (prompt: string) => void
}

function compressImage(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_SIZE = 1024
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

        const dataUrl = canvas.toDataURL('image/webp', 0.9)
        const base64 = dataUrl.split(',')[1] ?? ''
        resolve({ base64, mimeType: 'image/webp' })
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target?.result as string
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
  const [promptText, setPromptText] = useState('')
  const [mode, setMode] = useState<'photo' | 'text'>('photo')

  const handleFile = async (file: File) => {
    if (!file) return
    setIsProcessing(true)
    try {
      const { base64, mimeType } = await compressImage(file)
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
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
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
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Describe
        </button>
      </div>

      {mode === 'photo' ? (
        <>
          <div className="island-shell flex h-40 w-full max-w-sm flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--lagoon-deep)] p-6 text-center opacity-60">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[var(--lagoon-deep)]"
            >
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
            <p className="text-sm text-[var(--sea-ink-soft)]">Take or upload a photo of your meal</p>
          </div>

          <div className="flex w-full max-w-sm gap-3">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => cameraInputRef.current?.click()}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--lagoon-deep)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
              Take Photo
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => uploadInputRef.current?.click()}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--lagoon-deep)] bg-transparent px-4 py-3 text-sm font-semibold text-[var(--lagoon-deep)] transition hover:bg-[rgba(79,184,178,0.08)] disabled:opacity-60"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
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
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
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
