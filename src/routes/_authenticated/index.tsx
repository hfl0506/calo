import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getMealsByDateFn } from '#/lib/server/meals'
import { getUserSettingsFn } from '#/lib/server/settings'
import { prefetchMealDetail } from '#/lib/meal-prefetch-cache'
import { MEAL_TAG_EMOJI, MEAL_TAG_LABEL } from '#/lib/types'
import type { Meal, MealTag } from '#/lib/types'

function formatTime(date: Date | null): string {
  if (!date) return ''
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export const Route = createFileRoute('/_authenticated/')({
  component: HomePage,
})

function HomePage() {
  const navigate = useNavigate()
  const [meals, setMeals] = useState<Meal[]>([])
  const [dailyGoal, setDailyGoal] = useState(2000)
  const [isLoading, setIsLoading] = useState(true)
  const [savedNotice, setSavedNotice] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const search = Route.useSearch()

  useEffect(() => {
    const s = search as Record<string, unknown>
    if (s.saved) {
      setSavedNotice(true)
      setIsSaving(false)
      setTimeout(() => setSavedNotice(false), 3000)
      void navigate({ to: '/', replace: true })
      setRefreshKey((k) => k + 1)
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
  }, [search, navigate])

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const today = new Date().toLocaleDateString('en-CA', { timeZone: tz })

    Promise.all([
      getMealsByDateFn({ data: { date: today, timezone: tz } }),
      getUserSettingsFn(),
    ])
      .then(([mealsData, settings]) => {
        setMeals(mealsData as Meal[])
        setDailyGoal(settings.dailyCalorieGoal)
      })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [refreshKey])

  const totalCalories = meals.reduce((sum, m) => sum + m.totals.calories, 0)
  const totalProtein = meals.reduce((sum, m) => sum + m.totals.protein, 0)
  const totalCarbs = meals.reduce((sum, m) => sum + m.totals.carbs, 0)
  const totalFat = meals.reduce((sum, m) => sum + m.totals.fat, 0)
  const progressPercent = Math.min((totalCalories / dailyGoal) * 100, 100)

  const tagGroups = meals.reduce(
    (acc, meal) => {
      if (!acc[meal.tag]) acc[meal.tag] = 0
      acc[meal.tag]! += meal.totals.calories
      return acc
    },
    {} as Record<string, number>,
  )

  return (
    <div className="px-4 py-6 pb-24">
      {isSaving && (
        <div className="rise-in mb-4 flex items-center gap-3 rounded-xl border border-[var(--lagoon-deep)] bg-[rgba(79,184,178,0.08)] px-4 py-3">
          <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--lagoon-deep)] border-t-transparent" />
          <p className="text-sm font-medium text-[var(--lagoon-deep)]">Saving your meal…</p>
        </div>
      )}

      {savedNotice && (
        <div className="rise-in mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          Meal saved successfully!
        </div>
      )}

      {saveError && (
        <div className="rise-in mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          Failed to save meal. Please try again.
          <button type="button" onClick={() => setSaveError(false)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Today's Summary Card */}
      <div className="island-shell rise-in mb-6 rounded-2xl p-5">
        <div className="mb-3">
          <h2 className="text-base font-bold text-[var(--sea-ink)]">Today's Summary</h2>
        </div>

        <div className="mb-4 flex items-end gap-2">
          <span className="text-4xl font-bold text-[var(--sea-ink)]">
            {Math.round(totalCalories)}
          </span>
          <span className="mb-1 text-sm text-[var(--sea-ink-soft)]">/ {dailyGoal} kcal</span>
        </div>

        {/* Progress bar */}
        <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-[var(--line)]">
          <div
            className="h-full rounded-full bg-[var(--lagoon-deep)] transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

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
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--lagoon-deep)] border-t-transparent" />
        </div>
      ) : meals.length === 0 ? (
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
          {meals.map((meal) => (
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
  )
}
