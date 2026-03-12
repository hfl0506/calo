import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getMealsByDateFn } from '#/lib/server/meals'
import type { MealTag } from '#/lib/types'

export const Route = createFileRoute('/_authenticated/history/')({
  component: HistoryPage,
})

const MEAL_TAG_EMOJI: Record<MealTag, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snacks: '🍎',
}

const MEAL_TAG_LABEL: Record<MealTag, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
}

type MealWithFoods = {
  id: number
  userId: string
  tag: MealTag
  loggedAt: Date | null
  imageUrl: string | null
  notes: string | null
  createdAt: Date | null
  foods: Array<{
    id: number
    mealId: number
    name: string
    portionDescription: string | null
    calories: string
    protein: string | null
    carbs: string | null
    fat: string | null
    fiber: string | null
    createdAt: Date | null
  }>
  totals: {
    calories: number
    protein: number
    carbs: number
    fat: number
  }
}

function formatTime(date: Date | null): string {
  if (!date) return ''
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (dateStr === today.toISOString().split('T')[0]) return 'Today'
  if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday'
  return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}

function HistoryPage() {
  const [mealsByDate, setMealsByDate] = useState<Record<string, MealWithFoods[]>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchLast7Days = async () => {
      const results: Record<string, MealWithFoods[]> = {}
      const today = new Date()

      await Promise.all(
        Array.from({ length: 7 }, (_, i) => {
          const date = new Date(today)
          date.setDate(date.getDate() - i)
          const dateStr = date.toISOString().split('T')[0]!
          return getMealsByDateFn({ data: { date: dateStr } }).then((meals) => {
            if (meals.length > 0) {
              results[dateStr] = meals as MealWithFoods[]
            }
          })
        }),
      )

      setMealsByDate(results)
      setIsLoading(false)
    }

    void fetchLast7Days()
  }, [])

  const sortedDates = Object.keys(mealsByDate).sort((a, b) => b.localeCompare(a))

  return (
    <div className="px-4 py-6 pb-24">
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--sea-ink-soft)] transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
          aria-label="Back"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-[var(--sea-ink)]">History</h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--lagoon-deep)] border-t-transparent" />
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="text-5xl">📋</span>
          <h3 className="text-lg font-semibold text-[var(--sea-ink)]">No history yet</h3>
          <p className="text-sm text-[var(--sea-ink-soft)]">Start logging meals to see your history here.</p>
          <Link
            to="/log"
            className="rounded-xl bg-[var(--lagoon-deep)] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Log a meal
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateStr) => {
            const dateMeals = mealsByDate[dateStr] ?? []
            const totalCals = dateMeals.reduce((s, m) => s + m.totals.calories, 0)

            return (
              <div key={dateStr}>
                {/* Sticky date header */}
                <div className="sticky top-[3.5rem] z-10 -mx-4 mb-2 flex items-center justify-between bg-[var(--header-bg)] px-4 py-2 backdrop-blur">
                  <span className="text-sm font-bold text-[var(--sea-ink)]">
                    {formatDate(dateStr)}
                  </span>
                  <span className="text-xs text-[var(--sea-ink-soft)]">
                    {Math.round(totalCals)} kcal total
                  </span>
                </div>

                {/* Meals for this date */}
                <div className="space-y-2">
                  {dateMeals.map((meal) => (
                    <Link
                      key={meal.id}
                      to="/history/$mealId"
                      params={{ mealId: String(meal.id) }}
                      className="island-shell flex items-center gap-3 rounded-2xl p-4 transition hover:shadow-lg"
                    >
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
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-[var(--sea-ink-soft)]"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* FAB */}
      <Link
        to="/log"
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--lagoon-deep)] text-white shadow-xl transition hover:opacity-90 hover:shadow-2xl"
        aria-label="Log meal"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </Link>
    </div>
  )
}
