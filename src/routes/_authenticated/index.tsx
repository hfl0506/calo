import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import PullToRefresh from 'react-simple-pull-to-refresh'
import { getMealsByDateFn } from '#/lib/server/meals'
import { getUserSettingsFn } from '#/lib/server/settings'
import { prefetchMealDetail } from '#/lib/meal-prefetch-cache'
import { HomeSkeleton } from '#/components/SkeletonCard'
import { formatTime } from '#/lib/format'
import { MEAL_TAG_EMOJI, MEAL_TAG_LABEL } from '#/lib/types'
import type { Meal, MealTag } from '#/lib/types'

export const Route = createFileRoute('/_authenticated/')({
  loader: async () => {
    // getMealsByDateFn reads the tz cookie server-side to resolve the correct timezone
    const [meals, settings] = await Promise.all([
      getMealsByDateFn({ data: {} }),
      getUserSettingsFn(),
    ])
    return { meals: meals as Meal[], settings }
  },
  pendingComponent: HomeSkeleton,
  pendingMs: 0,
  component: HomePage,
})

function HomePage() {
  const navigate = useNavigate()
  const router = useRouter()
  const { meals, settings } = Route.useLoaderData()
  const [savedNotice, setSavedNotice] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const search = Route.useSearch()

  useEffect(() => {
    const s = search as Record<string, unknown>
    if (s.saved) {
      setSavedNotice(true)
      setIsSaving(false)
      setTimeout(() => setSavedNotice(false), 3000)
      void navigate({ to: '/', replace: true })
      void router.invalidate()
    }
    if (s.saving) {
      setIsSaving(true)
      setSaveError(false)
    }
    if (s.saveError) {
      setIsSaving(false)
      setSaveError(true)
      void navigate({ to: '/', replace: true })
    }
  }, [search, navigate, router])

  const handleRefresh = async () => {
    await router.invalidate()
  }

  const { totalCalories, totalProtein, totalCarbs, totalFat, tagGroups } = useMemo(() => {
    let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0
    const tagGroups: Record<string, number> = {}
    for (const m of meals) {
      totalCalories += m.totals.calories
      totalProtein  += m.totals.protein
      totalCarbs    += m.totals.carbs
      totalFat      += m.totals.fat
      tagGroups[m.tag] = (tagGroups[m.tag] ?? 0) + m.totals.calories
    }
    return { totalCalories, totalProtein, totalCarbs, totalFat, tagGroups }
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

      {/* Today's Summary Card */}
      <div className="island-shell rise-in mb-6 rounded-2xl p-5">
        <div className="mb-3">
          <h2 className="text-base font-bold text-[var(--sea-ink)]">Today's Summary</h2>
        </div>

        {(() => {
          const isOverGoal = totalCalories > settings.dailyCalorieGoal
          const progressPercent = Math.min((totalCalories / settings.dailyCalorieGoal) * 100, 100)
          const overBy = Math.round(totalCalories - settings.dailyCalorieGoal)
          return (
            <>
              <div className="mb-1 flex items-end gap-2">
                <span className={`text-4xl font-bold ${isOverGoal ? 'text-orange-500 dark:text-orange-400' : 'text-[var(--sea-ink)]'}`}>
                  {Math.round(totalCalories)}
                </span>
                <span className="mb-1 text-sm text-[var(--sea-ink-soft)]">/ {settings.dailyCalorieGoal} kcal</span>
              </div>
              {isOverGoal && (
                <p role="alert" className="mb-2 text-xs font-medium text-orange-500 dark:text-orange-400">
                  {overBy} kcal over your daily goal
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
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center rounded-xl bg-[var(--chip-bg)] py-2">
            <span className="text-base font-bold text-[var(--sea-ink)]">
              {Math.round(totalProtein * 10) / 10}g
            </span>
            <span className="text-xs text-[var(--sea-ink-soft)]">Protein</span>
          </div>
          <div className="flex flex-col items-center rounded-xl bg-[var(--chip-bg)] py-2">
            <span className="text-base font-bold text-[var(--sea-ink)]">
              {Math.round(totalCarbs * 10) / 10}g
            </span>
            <span className="text-xs text-[var(--sea-ink-soft)]">Carbs</span>
          </div>
          <div className="flex flex-col items-center rounded-xl bg-[var(--chip-bg)] py-2">
            <span className="text-base font-bold text-[var(--sea-ink)]">
              {Math.round(totalFat * 10) / 10}g
            </span>
            <span className="text-xs text-[var(--sea-ink-soft)]">Fat</span>
          </div>
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
          <h3 className="text-lg font-semibold text-[var(--sea-ink)]">No meals logged today</h3>
          <p className="text-sm text-[var(--sea-ink-soft)]">
            Start tracking your food intake by logging your first meal.
          </p>
          <Link
            to="/log"
            className="rounded-xl bg-[var(--lagoon-deep)] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Log your first meal
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--sea-ink-soft)]">Today's meals</h2>
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
