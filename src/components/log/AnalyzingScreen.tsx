export default function AnalyzingScreen() {
  return (
    <div className="rise-in flex flex-col items-center justify-center gap-4 py-16">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--lagoon-deep)] border-t-transparent" />
      <div className="text-center">
        <p className="text-base font-semibold text-[var(--sea-ink)]">
          Analyzing your meal…
        </p>
        <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
          This usually takes a few seconds
        </p>
      </div>
    </div>
  )
}
