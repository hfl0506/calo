import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/')({ component: HomePage })

function HomePage() {
  return (
    <div className="px-4 py-6">
      <h1 className="text-2xl font-bold text-[var(--sea-ink)]">Home</h1>
      <p className="mt-2 text-sm text-[var(--sea-ink-soft)]">Your content goes here.</p>
    </div>
  )
}
