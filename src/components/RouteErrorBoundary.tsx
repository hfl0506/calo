import { useRouter } from '@tanstack/react-router'

interface RouteErrorBoundaryProps {
  error: Error
  reset: () => void
}

export function RouteErrorBoundary({ error, reset }: RouteErrorBoundaryProps) {
  const router = useRouter()

  const handleRetry = () => {
    void router.invalidate()
    reset()
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <span className="text-4xl">⚠️</span>
      <h2 className="text-lg font-bold text-[var(--sea-ink)]">Something went wrong</h2>
      <p className="max-w-xs text-sm text-[var(--sea-ink-soft)]">{error.message}</p>
      <button
        type="button"
        onClick={handleRetry}
        className="rounded-xl bg-[var(--lagoon-deep)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
      >
        Try again
      </button>
    </div>
  )
}
