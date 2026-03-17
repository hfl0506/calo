import { useEffect, useRef, useState } from 'react'

interface UndoToastProps {
  message: string
  onUndo: () => void
  onDismiss: () => void
  durationMs?: number
}

export function UndoToast({ message, onUndo, onDismiss, durationMs = 5000 }: UndoToastProps) {
  const [progress, setProgress] = useState(100)
  const startRef = useRef(Date.now())
  const dismissedRef = useRef(false)

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current
      const remaining = Math.max(0, 100 - (elapsed / durationMs) * 100)
      setProgress(remaining)
      if (remaining === 0) {
        clearInterval(interval)
        if (!dismissedRef.current) {
          dismissedRef.current = true
          onDismiss()
        }
      }
    }, 50)

    return () => clearInterval(interval)
  }, [durationMs, onDismiss])

  const handleUndo = () => {
    dismissedRef.current = true
    onUndo()
  }

  return (
    <div role="alert" aria-live="assertive" className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.75rem)] left-4 right-4 z-50">
      <div className="island-shell overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--header-bg)] shadow-lg">
        {/* Progress bar */}
        <div
          className="h-0.5 bg-[var(--lagoon-deep)] transition-none"
          style={{ width: `${progress}%` }}
        />
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm text-[var(--sea-ink)]">{message}</p>
          <button
            type="button"
            onClick={handleUndo}
            className="ml-4 shrink-0 rounded-lg bg-[var(--lagoon-deep)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
          >
            Undo
          </button>
        </div>
      </div>
    </div>
  )
}
