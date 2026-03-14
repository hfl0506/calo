import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { getMealsRangeFn } from '#/lib/server/meals'
import { MEAL_TAG_EMOJI, MEAL_TAG_LABEL } from '#/lib/types'
import type { Meal } from '#/lib/types'

export const Route = createFileRoute('/_authenticated/history/')({
  component: HistoryPage,
})

function formatTime(date: Date | null): string {
  if (!date) return ''
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const today = new Date()
  const todayStr = today.toLocaleDateString('en-CA', { timeZone: tz })
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toLocaleDateString('en-CA', { timeZone: tz })

  if (dateStr === todayStr) return 'Today'
  if (dateStr === yesterdayStr) return 'Yesterday'
  return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}

const PAGE_DAYS = 7

function HistoryPage() {
  const [mealsByDate, setMealsByDate] = useState<Record<string, Meal[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [oldestDate, setOldestDate] = useState<string | null>(null)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const sentinelRef = useRef<HTMLDivElement>(null)
  const isLoadingMoreRef = useRef(false)

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  const fetchRange = async (endDate: string, append: boolean) => {
    const end = new Date(endDate + 'T00:00:00')
    const start = new Date(end)
    start.setDate(start.getDate() - (PAGE_DAYS - 1))
    const startDate = start.toLocaleDateString('en-CA', { timeZone: tz })

    const allMeals = await getMealsRangeFn({ data: { startDate, endDate, timezone: tz } })

    const grouped: Record<string, Meal[]> = {}
    for (const meal of allMeals as Meal[]) {
      const dateStr = new Date(meal.loggedAt!).toLocaleDateString('en-CA', { timeZone: tz })
      if (!grouped[dateStr]) grouped[dateStr] = []
      grouped[dateStr].push(meal)
    }

    setMealsByDate((prev) => append ? { ...prev, ...grouped } : grouped)
    setOldestDate(startDate)
    // If we got fewer days with data than requested, there's likely nothing further back
    if (allMeals.length === 0) setHasMore(false)
  }

  const toggleExpand = (dateStr: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev)
      if (next.has(dateStr)) next.delete(dateStr)
      else next.add(dateStr)
      return next
    })
  }

  useEffect(() => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: tz })
    fetchRange(today, false).finally(() => setIsLoading(false))
  }, [])

  const handleLoadMore = async () => {
    if (!oldestDate || isLoadingMoreRef.current) return
    isLoadingMoreRef.current = true
    setIsLoadingMore(true)
    try {
      const prev = new Date(oldestDate + 'T00:00:00')
      prev.setDate(prev.getDate() - 1)
      const newEnd = prev.toLocaleDateString('en-CA', { timeZone: tz })
      await fetchRange(newEnd, true)
    } catch {
      // silently stop — don't leave spinner stuck
    } finally {
      isLoadingMoreRef.current = false
      setIsLoadingMore(false)
    }
  }

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void handleLoadMore()
      },
      { threshold: 0.1 },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [oldestDate, hasMore])

  const sortedDates = Object.keys(mealsByDate).sort((a, b) => b.localeCompare(a))

  return (
    <div className="px-4 py-6 pb-24">
      <div className="mb-6">
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
            const totalProtein = dateMeals.reduce((s, m) => s + m.totals.protein, 0)
            const totalCarbs = dateMeals.reduce((s, m) => s + m.totals.carbs, 0)
            const totalFat = dateMeals.reduce((s, m) => s + m.totals.fat, 0)
            const isExpanded = expandedDates.has(dateStr)

            return (
              <div key={dateStr}>
                {/* Sticky date header */}
                <div className="sticky top-0 z-10 -mx-4 mb-2 bg-[var(--header-bg)] px-4 py-2 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[var(--sea-ink)]">
                      {formatDate(dateStr)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--sea-ink-soft)]">
                        {Math.round(totalCals)} kcal
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleExpand(dateStr)}
                        className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                          isExpanded
                            ? 'bg-[rgba(79,184,178,0.15)] text-[var(--lagoon-deep)]'
                            : 'text-[var(--sea-ink-soft)] hover:bg-[var(--chip-bg)] hover:text-[var(--sea-ink)]'
                        }`}
                        aria-label="Toggle macro breakdown"
                      >
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
                        >
                          <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                          <path d="M22 12A10 10 0 0 0 12 2v10z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Macro breakdown row */}
                  {isExpanded && (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <div className="flex flex-col items-center rounded-lg bg-[var(--chip-bg)] py-1.5">
                        <span className="text-sm font-bold text-[var(--sea-ink)]">
                          {Math.round(totalProtein * 10) / 10}g
                        </span>
                        <span className="text-[10px] text-[var(--sea-ink-soft)]">Protein</span>
                      </div>
                      <div className="flex flex-col items-center rounded-lg bg-[var(--chip-bg)] py-1.5">
                        <span className="text-sm font-bold text-[var(--sea-ink)]">
                          {Math.round(totalCarbs * 10) / 10}g
                        </span>
                        <span className="text-[10px] text-[var(--sea-ink-soft)]">Carbs</span>
                      </div>
                      <div className="flex flex-col items-center rounded-lg bg-[var(--chip-bg)] py-1.5">
                        <span className="text-sm font-bold text-[var(--sea-ink)]">
                          {Math.round(totalFat * 10) / 10}g
                        </span>
                        <span className="text-[10px] text-[var(--sea-ink-soft)]">Fat</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Meals for this date */}
                <div className="space-y-2">
                  {dateMeals.map((meal) => (
                    <Link
                      key={meal.id}
                      to="/history/$mealId"
                      params={{ mealId: meal.id }}
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

          {/* Infinite scroll sentinel */}
          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-4">
              {isLoadingMore && (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--lagoon-deep)] border-t-transparent" />
              )}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
