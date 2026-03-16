import { computeInsights } from '#/lib/analytics'
import type { DayData } from '#/lib/analytics'

interface InsightsCardProps {
  days: DayData[]
  calorieGoal: number
  macroGoals: { protein: number | null; carbs: number | null; fat: number | null }
}

export function InsightsCard({ days, calorieGoal, macroGoals }: InsightsCardProps) {
  const insights = computeInsights(days, calorieGoal, macroGoals)

  if (insights.loggedDays === 0) return null

  const isSurplus = insights.totalDeficitSurplus > 0
  const absValue = Math.abs(insights.totalDeficitSurplus)

  return (
    <div className="island-shell rounded-2xl p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">
        Period Summary
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col rounded-xl bg-[var(--chip-bg)] p-3">
          <span className="text-lg font-bold text-[var(--sea-ink)]">{insights.avgCalories}</span>
          <span className="text-xs text-[var(--sea-ink-soft)]">avg kcal/day</span>
        </div>
        <div className="flex flex-col rounded-xl bg-[var(--chip-bg)] p-3">
          <span
            className={`text-lg font-bold ${
              isSurplus
                ? 'text-orange-500'
                : 'text-green-600 dark:text-green-400'
            }`}
          >
            {isSurplus ? '+' : '-'}{absValue}
          </span>
          <span className="text-xs text-[var(--sea-ink-soft)]">
            {isSurplus ? 'total surplus' : 'total deficit'} kcal
          </span>
        </div>
      </div>

      {insights.macroWarnings.length > 0 && (
        <div className="space-y-1">
          {insights.macroWarnings.map((w) => (
            <div
              key={w}
              className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-950"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-amber-500">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
