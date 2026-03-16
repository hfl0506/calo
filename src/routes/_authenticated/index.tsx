import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import PullToRefresh from 'react-simple-pull-to-refresh'
import { getMealsByDateFn, getStreakFn } from '#/lib/server/meals'
import { getUserSettingsFn } from '#/lib/server/settings'
import { prefetchMealDetail } from '#/lib/meal-prefetch-cache'
import { HomeSkeleton } from '#/components/SkeletonCard'
import { formatTime } from '#/lib/format'
import { MEAL_TAG_EMOJI, MEAL_TAG_LABEL } from '#/lib/types'
import type { MealTag } from '#/lib/types'

const homeSearchSchema = z.object({
  date: z.string().optional(),
  saved: z.boolean().optional(),
  saving: z.boolean().optional(),
  saveError: z.boolean().optional(),
})

export const Route = createFileRoute('/_authenticated/')({
  validateSearch: homeSearchSchema,
  loaderDeps: ({ search }) => ({ date: search.date }),
  loader: async ({ deps }) => {
    const [meals, settings, streakData] = await Promise.all([
      getMealsByDateFn({ data: deps.date ? { date: deps.date } : {} }),
      getUserSettingsFn(),
      getStreakFn(),
    ])
    return { meals, settings, streak: streakData.streak }
  },
  pendingComponent: HomeSkeleton,
  pendingMs: 0,
  component: HomePage,
})

function getTodayLocal(): string {
  return new Date().toLocaleDateString('en-CA')
}

function formatDateLabel(dateStr: string): string {
  const today = getTodayLocal()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toLocaleDateString('en-CA')

  if (dateStr === today) return "Today's Summary"
  if (dateStr === yesterdayStr) return "Yesterday's Summary"
  // Format as "Mon, Mar 15"
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function shiftDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-CA')
}

function HomePage() {
  const navigate = useNavigate()
  const router = useRouter()
  const { meals, settings, streak } = Route.useLoaderData()
  const search = Route.useSearch()
  const [savedNotice, setSavedNotice] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  const today = getTodayLocal()
  const currentDate = search.date ?? today
  const isToday = currentDate === today

  useEffect(() => {
    if (search.saved) {
      setSavedNotice(true)
      setIsSaving(false)
      setTimeout(() => setSavedNotice(false), 3000)
      void navigate({ to: '/', search: (prev) => ({ ...prev, saved: undefined }), replace: true })
      void router.invalidate()
    }
    if (search.saving) {
      setIsSaving(true)
      setSaveError(false)
    }
    if (search.saveError) {
      setIsSaving(false)
      setSaveError(true)
      void navigate({ to: '/', search: (prev) => ({ ...prev, saveError: undefined }), replace: true })
    }
  }, [search, navigate, router])

  const handleRefresh = async () => {
    await router.invalidate()
  }

  const handlePrevDay = () => {
    void navigate({ to: '/', search: { date: shiftDate(currentDate, -1) } })
  }

  const handleNextDay = () => {
    const next = shiftDate(currentDate, 1)
    if (next > today) return
    void navigate({ to: '/', search: next === today ? {} : { date: next } })
  }

  const { totalCalories, totalProtein, totalCarbs, totalFat, totalFiber, tagGroups } = useMemo(() => {
    let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0, totalFiber = 0
    const tagGroups: Record<string, number> = {}
    for (const m of meals) {
      totalCalories += m.totals.calories
      totalProtein  += m.totals.protein
      totalCarbs    += m.totals.carbs
      totalFat      += m.totals.fat
      totalFiber    += m.totals.fiber
      tagGroups[m.tag] = (tagGroups[m.tag] ?? 0) + m.totals.calories
    }
    return { totalCalories, totalProtein, totalCarbs, totalFat, totalFiber, tagGroups }
  }, [meals])

  return (
    <PullToRefresh onRefresh={handleRefresh} pullingContent="" refreshingContent={
      <div className="flex justify-center py-3">
        <div role="status" aria-label="Refreshing" className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--lagoon-deep)] border-t-transparent" />
      </div>
    }>
    <div className="px-4 py-6 pb-24">
      {isSaving && (
        <div role="status" className="rise-in mb-4 flex items-center gap-3 rounded-xl border border-[var(--lagoon-deep)] bg-[rgba(79,184,178,0.08)] px-4 py-3">
          <div aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--lagoon-deep)] border-t-transparent" />
          <p className="text-sm font-medium text-[var(--lagoon-deep)]">Saving your meal…</p>
        </div>
      )}

      {savedNotice && (
        <div role="status" aria-live="polite" className="rise-in mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          Meal saved successfully!
        </div>
      )}

      {saveError && (
        <div role="alert" className="rise-in mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          Failed to save meal. Please try again.
          <button type="button" onClick={() => setSaveError(false)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Summary Card */}
      <div className="island-shell rise-in mb-6 rounded-2xl p-5">
        {/* Header: date nav + streak */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevDay}
              aria-label="Previous day"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--sea-ink-soft)] transition hover:bg-[var(--chip-bg)] hover:text-[var(--sea-ink)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <h2 className="text-base font-bold text-[var(--sea-ink)]">{formatDateLabel(currentDate)}</h2>
            <button
              type="button"
              onClick={handleNextDay}
              disabled={isToday}
              aria-label="Next day"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--sea-ink-soft)] transition hover:bg-[var(--chip-bg)] hover:text-[var(--sea-ink)] disabled:opacity-30"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
          {streak > 0 && isToday && (
            <span className="flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-500 dark:bg-orange-950 dark:text-orange-400">
              🔥 {streak} day{streak !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {(() => {
          const isOverGoal = totalCalories > settings.dailyCalorieGoal
          const progressPercent = Math.min((totalCalories / settings.dailyCalorieGoal) * 100, 100)
          const overBy = Math.round(totalCalories - settings.dailyCalorieGoal)
          const remaining = Math.round(settings.dailyCalorieGoal - totalCalories)
          return (
            <>
              <div className="mb-1 flex items-end gap-2">
                <span className={`text-4xl font-bold ${isOverGoal ? 'text-orange-500 dark:text-orange-400' : 'text-[var(--sea-ink)]'}`}>
                  {Math.round(totalCalories)}
                </span>
                <span className="mb-1 text-sm text-[var(--sea-ink-soft)]">/ {settings.dailyCalorieGoal} kcal</span>
              </div>
              {isOverGoal ? (
                <p role="alert" className="mb-2 text-xs font-medium text-orange-500 dark:text-orange-400">
                  {overBy} kcal over your daily goal
                </p>
              ) : (
                <p className="mb-2 text-xs text-[var(--sea-ink-soft)]">
                  {remaining} kcal remaining
                </p>
              )}
              <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-[var(--line)]">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${isOverGoal ? 'bg-orange-400' : 'bg-[var(--lagoon-deep)]'}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </>
          )
        })()}

        {/* Macro totals */}
        <div className="mb-4 grid grid-cols-4 gap-2">
          {(
            [
              { label: 'Protein', value: totalProtein, goal: settings.proteinGoal, color: '#6366f1' },
              { label: 'Carbs',   value: totalCarbs,   goal: settings.carbsGoal,   color: '#d97706' },
              { label: 'Fat',     value: totalFat,     goal: settings.fatGoal,     color: '#e11d48' },
              { label: 'Fiber',   value: totalFiber,   goal: settings.fiberGoal,  color: '#16a34a' },
            ] as { label: string; value: number; goal: number | null; color: string }[]
          ).map(({ label, value, goal, color }) => {
            const rounded = Math.round(value * 10) / 10
            const pct = goal ? Math.min((value / goal) * 100, 100) : null
            const isOver = goal !== null && value > goal
            return (
              <div key={label} className="flex flex-col rounded-xl bg-[var(--chip-bg)] px-2 py-2">
                <span className="text-sm font-bold text-[var(--sea-ink)]">{rounded}g</span>
                {goal ? (
                  <span className="text-[9px] leading-tight" style={{ color: isOver ? '#ef4444' : 'var(--sea-ink-soft)' }}>
                    / {goal}g {label}
                  </span>
                ) : (
                  <span className="text-[10px] leading-tight text-[var(--sea-ink-soft)]">{label}</span>
                )}
                {pct !== null && (
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--line)]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: isOver ? '#ef4444' : color }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Per-meal-tag breakdown */}
        {Object.keys(tagGroups).length > 0 && (
          <div className="flex gap-4">
            {(Object.entries(tagGroups) as [MealTag, number][]).map(([tag, cals]) => (
              <div key={tag} className="flex flex-col items-center gap-0.5">
                <span className="text-lg">{MEAL_TAG_EMOJI[tag]}</span>
                <span className="text-xs font-semibold text-[var(--sea-ink)]">
                  {Math.round(cals)}
                </span>
                <span className="text-xs text-[var(--sea-ink-soft)]">{MEAL_TAG_LABEL[tag]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Meals list */}
      {meals.length === 0 ? (
        <div className="rise-in flex flex-col items-center gap-4 py-12 text-center">
          <span className="text-5xl">🥗</span>
          <h3 className="text-lg font-semibold text-[var(--sea-ink)]">
            {isToday ? 'No meals logged today' : 'No meals logged this day'}
          </h3>
          <p className="text-sm text-[var(--sea-ink-soft)]">
            {isToday ? 'Start tracking your food intake by logging your first meal.' : 'Nothing was logged on this day.'}
          </p>
          {isToday && (
            <Link
              to="/log"
              className="rounded-xl bg-[var(--lagoon-deep)] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Log your first meal
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--sea-ink-soft)]">
            {isToday ? "Today's meals" : 'Meals'}
          </h2>
          {meals.map((meal, i) => (
            <Link
              key={meal.id}
              to="/history/$mealId"
              params={{ mealId: meal.id }}
              className="island-shell block overflow-hidden rounded-2xl transition hover:shadow-lg"
              onMouseEnter={() => prefetchMealDetail(meal.id)}
              onTouchStart={() => prefetchMealDetail(meal.id)}
            >
              {meal.imageUrl && (
                <img
                  src={meal.imageUrl}
                  alt={MEAL_TAG_LABEL[meal.tag]}
                  className="h-36 w-full object-cover"
                  loading={i === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  fetchPriority={i === 0 ? 'high' : 'low'}
                />
              )}
              <div className="flex items-center gap-3 p-4">
                <span className="text-2xl">{MEAL_TAG_EMOJI[meal.tag]}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--sea-ink)]">
                      {MEAL_TAG_LABEL[meal.tag]}
                    </span>
                    <span className="text-sm font-bold text-[var(--sea-ink)]">
                      {Math.round(meal.totals.calories)} kcal
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--sea-ink-soft)]">
                      {meal.foods
                        .slice(0, 2)
                        .map((f) => f.name)
                        .join(', ')}
                      {meal.foods.length > 2 ? ` +${meal.foods.length - 2} more` : ''}
                    </span>
                    <span className="text-xs text-[var(--sea-ink-soft)]">
                      {formatTime(meal.loggedAt)}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

    </div>
    </PullToRefresh>
  )
}
