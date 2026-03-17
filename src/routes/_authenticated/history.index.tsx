import { createFileRoute, Link } from '@tanstack/react-router'
import { LoadingSpinner } from '#/components/LoadingSpinner'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getMealsRangeFn } from '#/lib/server/meals'
import { MealCard } from '#/components/MealCard'
import { HistorySkeleton } from '#/components/SkeletonCard'
import { formatDate } from '#/lib/format'
import { roundMacro } from '#/lib/nutrition'
import { CalorieTrendChart } from '#/components/CalorieTrendChart'
import type { Meal } from '#/lib/types'
import { groupMealsByDate } from '#/lib/meal-utils'
import { getClientTimezone } from '#/lib/timezone'
import { RouteErrorBoundary } from '#/components/RouteErrorBoundary'
import { PieChart } from 'lucide-react'

const PAGE_DAYS = 7

export const Route = createFileRoute('/_authenticated/history/')({
  loader: async () => {
    const tz = getClientTimezone()
    const today = new Date().toLocaleDateString('en-CA', { timeZone: tz })
    const start = new Date()
    start.setDate(start.getDate() - (PAGE_DAYS - 1))
    const startDate = start.toLocaleDateString('en-CA', { timeZone: tz })

    const allMeals = await getMealsRangeFn({ data: { startDate, endDate: today, timezone: tz } })
    const grouped = groupMealsByDate(allMeals, tz)
    return { initialMeals: grouped, oldestDate: startDate, hasMore: allMeals.length > 0 }
  },
  pendingComponent: () => (
    <div className="px-4 py-6 pb-24">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--sea-ink)]">History</h1>
      </div>
      <HistorySkeleton />
    </div>
  ),
  pendingMs: 0,
  staleTime: 30_000,
  component: HistoryPage,
  errorComponent: ({ error, reset }) => <RouteErrorBoundary error={error} reset={reset} />,
})


function HistoryPage() {
  const loaderData = Route.useLoaderData()
  const [view, setView] = useState<'list' | 'trend'>('list')
  const [mealsByDate, setMealsByDate] = useState<Record<string, Meal[]>>(loaderData.initialMeals)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(loaderData.hasMore)
  const [oldestDate, setOldestDate] = useState<string>(loaderData.oldestDate)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [loadMoreError, setLoadMoreError] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const isLoadingMoreRef = useRef(false)
  const consecutiveEmptyRef = useRef(loaderData.hasMore ? 0 : 1)

  const tz = getClientTimezone()

  const fetchRange = useCallback(async (endDate: string) => {
    const end = new Date(endDate + 'T00:00:00')
    const start = new Date(end)
    start.setDate(start.getDate() - (PAGE_DAYS - 1))
    const startDate = start.toLocaleDateString('en-CA', { timeZone: tz })

    const allMeals = await getMealsRangeFn({ data: { startDate, endDate, timezone: tz } })
    const grouped = groupMealsByDate(allMeals, tz)

    setMealsByDate((prev) => ({ ...prev, ...grouped }))
    setOldestDate(startDate)
    if (allMeals.length === 0) {
      consecutiveEmptyRef.current += 1
      if (consecutiveEmptyRef.current >= 3) setHasMore(false)
    } else {
      consecutiveEmptyRef.current = 0
    }
  }, [tz])

  const toggleExpand = (dateStr: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev)
      if (next.has(dateStr)) next.delete(dateStr)
      else next.add(dateStr)
      return next
    })
  }

  const handleLoadMore = useCallback(async () => {
    if (!oldestDate || isLoadingMoreRef.current) return
    isLoadingMoreRef.current = true
    setIsLoadingMore(true)
    try {
      const prev = new Date(oldestDate + 'T00:00:00')
      prev.setDate(prev.getDate() - 1)
      const newEnd = prev.toLocaleDateString('en-CA', { timeZone: tz })
      await fetchRange(newEnd)
    } catch (err) {
      console.error('[history] failed to load more:', err)
      setLoadMoreError(true)
      setHasMore(false)
    } finally {
      isLoadingMoreRef.current = false
      setIsLoadingMore(false)
    }
  }, [oldestDate, tz, fetchRange])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void handleLoadMore()
      },
      { threshold: 0.1 },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [handleLoadMore, hasMore])

  const sortedDates = Object.keys(mealsByDate).sort((a, b) => b.localeCompare(a))

  return (
    <div className="px-4 py-6 pb-24">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--sea-ink)]">History</h1>
        <div className="flex overflow-hidden rounded-lg border border-[var(--line)]">
          <button
            type="button"
            onClick={() => setView('list')}
            className={`px-3 py-1.5 text-xs font-semibold transition ${
              view === 'list'
                ? 'bg-[var(--lagoon-deep)] text-white'
                : 'text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]'
            }`}
          >
            Log
          </button>
          <button
            type="button"
            onClick={() => setView('trend')}
            className={`px-3 py-1.5 text-xs font-semibold transition ${
              view === 'trend'
                ? 'bg-[var(--lagoon-deep)] text-white'
                : 'text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]'
            }`}
          >
            Trend
          </button>
        </div>
      </div>

      {view === 'trend' && <CalorieTrendChart />}

      {view === 'list' && (sortedDates.length === 0 ? (
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
                        aria-expanded={isExpanded}
                      >
                        <PieChart size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Macro breakdown row */}
                  {isExpanded && (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <div className="flex flex-col items-center rounded-lg bg-[var(--chip-bg)] py-1.5">
                        <span className="text-sm font-bold text-[var(--sea-ink)]">
                          {roundMacro(totalProtein)}g
                        </span>
                        <span className="text-[10px] text-[var(--sea-ink-soft)]">Protein</span>
                      </div>
                      <div className="flex flex-col items-center rounded-lg bg-[var(--chip-bg)] py-1.5">
                        <span className="text-sm font-bold text-[var(--sea-ink)]">
                          {roundMacro(totalCarbs)}g
                        </span>
                        <span className="text-[10px] text-[var(--sea-ink-soft)]">Carbs</span>
                      </div>
                      <div className="flex flex-col items-center rounded-lg bg-[var(--chip-bg)] py-1.5">
                        <span className="text-sm font-bold text-[var(--sea-ink)]">
                          {roundMacro(totalFat)}g
                        </span>
                        <span className="text-[10px] text-[var(--sea-ink-soft)]">Fat</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Meals for this date */}
                <div className="space-y-2">
                  {dateMeals.map((meal) => (
                    <MealCard key={meal.id} meal={meal} showChevron />
                  ))}
                </div>
              </div>
            )
          })}

          {/* Infinite scroll sentinel */}
          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-4">
              {isLoadingMore && (
                <LoadingSpinner size="md" label="Loading more meals" />
              )}
            </div>
          )}

          {!hasMore && (
            <p className="py-6 text-center text-sm text-[var(--sea-ink-soft)]">
              {loadMoreError ? 'Failed to load more history.' : "You've reached the beginning of your history"}
            </p>
          )}
        </div>
      ))}

    </div>
  )
}
