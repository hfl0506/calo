import { useEffect, useState } from 'react'
import { getMealsRangeFn } from '#/lib/server/meals'
import { getUserSettingsFn } from '#/lib/server/settings'
import { TrendChartSkeleton } from '#/components/SkeletonCard'
import { InsightsCard } from '#/components/InsightsCard'
import { SvgBarChart } from '#/components/SvgBarChart'
import type { Meal } from '#/lib/types'
import type { DayData } from '#/lib/analytics'

type Period = '7d' | '14d' | '30d' | 'custom'
type Metric = 'calories' | 'protein' | 'carbs' | 'fat'

const METRICS: { key: Metric; label: string; unit: string; color: string; selectedColor: string }[] = [
  { key: 'calories', label: 'Cal',     unit: 'kcal', color: 'var(--lagoon)',  selectedColor: 'var(--lagoon-deep)' },
  { key: 'protein',  label: 'Protein', unit: 'g',    color: '#818cf8',        selectedColor: '#6366f1' },
  { key: 'carbs',    label: 'Carbs',   unit: 'g',    color: '#fbbf24',        selectedColor: '#d97706' },
  { key: 'fat',      label: 'Fat',     unit: 'g',    color: '#fb7185',        selectedColor: '#e11d48' },
]

function formatDetailDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function CalorieTrendChart() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const today = new Date().toLocaleDateString('en-CA', { timeZone: tz })

  const [period, setPeriod] = useState<Period>('7d')
  const [metric, setMetric] = useState<Metric>('calories')
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 13)
    return d.toLocaleDateString('en-CA', { timeZone: tz })
  })
  const [customEnd, setCustomEnd] = useState(today)
  const [days, setDays] = useState<DayData[]>([])
  const [goal, setGoal] = useState(2000)
  const [macroGoals, setMacroGoals] = useState<{ protein: number | null; carbs: number | null; fat: number | null }>({ protein: null, carbs: null, fat: null })
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  const fetchData = async (startDate: string, endDate: string) => {
    setIsLoading(true)
    setFetchError(null)
    try {
      const [meals, settings] = await Promise.all([
        getMealsRangeFn({ data: { startDate, endDate, timezone: tz } }),
        getUserSettingsFn(),
      ])

      setGoal(settings.dailyCalorieGoal)
      setMacroGoals({ protein: settings.proteinGoal, carbs: settings.carbsGoal, fat: settings.fatGoal })

      const dataMap = new Map<string, DayData>()
      const cur = new Date(startDate + 'T12:00:00')
      const endDt = new Date(endDate + 'T12:00:00')
      while (cur <= endDt) {
        const ds = cur.toLocaleDateString('en-CA')
        dataMap.set(ds, { date: ds, calories: 0, protein: 0, carbs: 0, fat: 0 })
        cur.setDate(cur.getDate() + 1)
      }

      for (const meal of meals as Meal[]) {
        const ds = new Date(meal.loggedAt!).toLocaleDateString('en-CA', { timeZone: tz })
        const ex = dataMap.get(ds)
        if (ex) {
          ex.calories += meal.totals.calories
          ex.protein += meal.totals.protein
          ex.carbs += meal.totals.carbs
          ex.fat += meal.totals.fat
        }
      }

      const sorted = Array.from(dataMap.values()).sort((a, b) => a.date.localeCompare(b.date))
      setDays(sorted)
      setSelectedIdx(sorted.length - 1)
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (period === 'custom') return
    const end = new Date()
    const dayCount = period === '7d' ? 7 : period === '14d' ? 14 : 30
    const start = new Date()
    start.setDate(start.getDate() - (dayCount - 1))
    void fetchData(
      start.toLocaleDateString('en-CA', { timeZone: tz }),
      end.toLocaleDateString('en-CA', { timeZone: tz }),
    )
  }, [period])

  const handleCustomFetch = () => {
    if (!customStart || !customEnd || customEnd < customStart) return
    void fetchData(customStart, customEnd)
  }

  const activeMetric = METRICS.find((m) => m.key === metric)!
  const getValue = (d: DayData) => d[metric]
  const daysWithData = days.filter((d) => getValue(d) > 0)
  const avg =
    daysWithData.length > 0
      ? Math.round((daysWithData.reduce((s, d) => s + getValue(d), 0) / daysWithData.length) * 10) / 10
      : 0
  const selectedDay = selectedIdx !== null ? (days[selectedIdx] ?? null) : null

  return (
    <div className="space-y-3">
      {/* Period selector */}
      <div className="flex gap-1 rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] p-1">
        {(['7d', '14d', '30d', 'custom'] as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
              period === p
                ? 'bg-[var(--lagoon-deep)] text-white shadow-sm'
                : 'text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]'
            }`}
          >
            {p === 'custom' ? 'Custom' : p}
          </button>
        ))}
      </div>

      {/* Custom date picker */}
      {period === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStart}
            max={customEnd || today}
            onChange={(e) => setCustomStart(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--chip-bg)] px-2 py-1.5 text-xs text-[var(--sea-ink)]"
          />
          <span className="shrink-0 text-xs text-[var(--sea-ink-soft)]">→</span>
          <input
            type="date"
            value={customEnd}
            min={customStart}
            max={today}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--chip-bg)] px-2 py-1.5 text-xs text-[var(--sea-ink)]"
          />
          <button
            type="button"
            onClick={handleCustomFetch}
            disabled={!customStart || !customEnd || customEnd < customStart}
            className="shrink-0 rounded-lg bg-[var(--lagoon-deep)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            Go
          </button>
        </div>
      )}

      {/* Metric selector */}
      <div className="flex gap-2">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMetric(m.key)}
            className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold transition ${
              metric === m.key
                ? 'text-white shadow-sm'
                : 'border-[var(--line)] bg-[var(--chip-bg)] text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]'
            }`}
            style={
              metric === m.key
                ? { backgroundColor: m.selectedColor, borderColor: m.selectedColor }
                : {}
            }
          >
            {m.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <TrendChartSkeleton />
      ) : fetchError ? (
        <div className="flex h-44 flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-red-500">{fetchError}</p>
          <button
            type="button"
            onClick={() => {
              if (period === 'custom') {
                void fetchData(customStart, customEnd)
              } else {
                const end = new Date()
                const dayCount = period === '7d' ? 7 : period === '14d' ? 14 : 30
                const start = new Date()
                start.setDate(start.getDate() - (dayCount - 1))
                void fetchData(
                  start.toLocaleDateString('en-CA', { timeZone: tz }),
                  end.toLocaleDateString('en-CA', { timeZone: tz }),
                )
              }
            }}
            className="text-xs text-[var(--lagoon-deep)] underline"
          >
            Retry
          </button>
        </div>
      ) : days.length === 0 ? (
        <div className="flex h-44 items-center justify-center">
          <p className="text-sm text-[var(--sea-ink-soft)]">No data for this period</p>
        </div>
      ) : (
        <>
          {/* Chart card */}
          <div className="island-shell rounded-2xl px-3 pb-3 pt-4">
            <div className="mb-3 flex items-baseline justify-between px-1">
              <span className="text-xs font-semibold" style={{ color: activeMetric.selectedColor }}>
                {activeMetric.label === 'Cal' ? 'Calories' : activeMetric.label}
              </span>
              <div className="flex items-center gap-3">
                {avg > 0 && (
                  <span className="text-xs text-[var(--sea-ink-soft)]">
                    avg{' '}
                    <span className="font-semibold text-[var(--sea-ink)]">
                      {avg}
                    </span>{' '}
                    {activeMetric.unit}
                  </span>
                )}
                {(metric === 'calories' || (metric === 'protein' && macroGoals.protein) || (metric === 'carbs' && macroGoals.carbs) || (metric === 'fat' && macroGoals.fat)) && (
                  <div className="flex items-center gap-1">
                    <svg width="16" height="4" viewBox="0 0 16 4">
                      <line x1="0" y1="2" x2="16" y2="2" stroke={activeMetric.selectedColor} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6" />
                    </svg>
                    <span className="text-[10px] text-[var(--sea-ink-soft)]">goal</span>
                  </div>
                )}
              </div>
            </div>

            <SvgBarChart
              days={days}
              getValue={getValue}
              barColor={activeMetric.color}
              activeColor={activeMetric.selectedColor}
              goalValue={
                metric === 'calories' ? goal
                : metric === 'protein' ? (macroGoals.protein ?? undefined)
                : metric === 'carbs' ? (macroGoals.carbs ?? undefined)
                : (macroGoals.fat ?? undefined)
              }
              selectedIdx={selectedIdx}
              onSelect={setSelectedIdx}
            />
          </div>

          {/* Selected day detail */}
          {selectedDay && (
            <div className="island-shell rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[var(--sea-ink)]">
                  {formatDetailDate(selectedDay.date)}
                </span>
                {selectedDay.calories > 0 ? (
                  <span className="text-sm font-bold" style={{ color: activeMetric.selectedColor }}>
                    {metric === 'calories'
                      ? `${Math.round(selectedDay.calories)} kcal`
                      : `${Math.round(getValue(selectedDay) * 10) / 10}g`}
                    {metric === 'calories' && (
                      <span className="font-normal text-[var(--sea-ink-soft)]"> / {goal} kcal</span>
                    )}
                  </span>
                ) : (
                  <span className="text-xs text-[var(--sea-ink-soft)]">No meals logged</span>
                )}
              </div>

              {selectedDay.calories > 0 && (
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {METRICS.map(({ key, label, unit, selectedColor }) => {
                    const val = selectedDay[key]
                    const isActive = key === metric
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setMetric(key)}
                        className={`flex flex-col items-center rounded-lg py-1.5 transition ${
                          isActive ? 'ring-1' : 'bg-[var(--chip-bg)]'
                        }`}
                        style={
                          isActive
                            ? { backgroundColor: `${selectedColor}18`, outline: `1px solid ${selectedColor}` }
                            : {}
                        }
                      >
                        <span
                          className="text-sm font-bold"
                          style={{ color: isActive ? selectedColor : 'var(--sea-ink)' }}
                        >
                          {key === 'calories'
                            ? Math.round(val)
                            : Math.round(val * 10) / 10}
                        </span>
                        <span className="text-[9px] text-[var(--sea-ink-soft)]">
                          {label === 'Cal' ? 'kcal' : unit}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <InsightsCard
            days={days}
            calorieGoal={goal}
            macroGoals={macroGoals}
          />
        </>
      )}
    </div>
  )
}
