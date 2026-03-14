import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { deleteMealFn, getMealDetailFn } from '#/lib/server/meals'
import { getCachedMealDetail } from '#/lib/meal-prefetch-cache'
import { MEAL_TAG_EMOJI, MEAL_TAG_LABEL } from '#/lib/types'
import type { MealTag } from '#/lib/types'

export const Route = createFileRoute('/_authenticated/history/$mealId')({
  component: MealDetailPage,
})

type MealDetail = {
  id: string
  userId: string
  tag: MealTag
  loggedAt: Date | null
  imageUrl: string | null
  notes: string | null
  createdAt: Date | null
  foods: Array<{
    id: number
    mealId: string
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

function formatDateTime(date: Date | null): string {
  if (!date) return ''
  return new Date(date).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function MealDetailPage() {
  const { mealId } = Route.useParams()
  const navigate = useNavigate()
  const cached = getCachedMealDetail(mealId) as MealDetail | null
  const [meal, setMeal] = useState<MealDetail | null>(cached)
  const [isLoading, setIsLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showLightbox, setShowLightbox] = useState(false)

  useEffect(() => {
    getMealDetailFn({ data: { mealId } })
      .then((data) => setMeal(data as MealDetail))
      .catch((err) => { if (!cached) setError(err instanceof Error ? err.message : 'Failed to load meal') })
      .finally(() => setIsLoading(false))
  }, [mealId])

  const handleDelete = async () => {
    navigator.vibrate?.(10)
    setIsDeleting(true)
    try {
      await deleteMealFn({ data: { mealId } })
      await navigate({ to: '/history' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete meal')
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <div className="px-4 py-6 pb-24">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/history"
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
          <h1 className="text-xl font-bold text-[var(--sea-ink)]">Meal Detail</h1>
        </div>

        {meal && (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500 text-white transition hover:bg-red-600"
            aria-label="Delete meal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--lagoon-deep)] border-t-transparent" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      ) : meal ? (
        <div className="rise-in space-y-4">
          {/* Meal header card */}
          <div className="island-shell rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{MEAL_TAG_EMOJI[meal.tag]}</span>
              <div>
                <h2 className="text-lg font-bold text-[var(--sea-ink)]">
                  {MEAL_TAG_LABEL[meal.tag]}
                </h2>
                <p className="text-sm text-[var(--sea-ink-soft)]">{formatDateTime(meal.loggedAt)}</p>
              </div>
            </div>
          </div>

          {/* Image if available */}
          {meal.imageUrl && (
            <button
              type="button"
              onClick={() => setShowLightbox(true)}
              className="island-shell w-full overflow-hidden rounded-2xl"
            >
              <img src={meal.imageUrl} alt="Meal" className="h-48 w-full object-cover" />
            </button>
          )}

          {/* Nutrition totals */}
          <div className="island-shell rounded-2xl p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--sea-ink)]">Nutrition Totals</h3>
            <div className="grid grid-cols-4 gap-3">
              <NutrientCard label="Calories" value={Math.round(meal.totals.calories)} unit="kcal" large />
              <NutrientCard label="Protein" value={Math.round(meal.totals.protein * 10) / 10} unit="g" />
              <NutrientCard label="Carbs" value={Math.round(meal.totals.carbs * 10) / 10} unit="g" />
              <NutrientCard label="Fat" value={Math.round(meal.totals.fat * 10) / 10} unit="g" />
            </div>
          </div>

          {/* Food list */}
          <div className="space-y-2">
            <h3 className="px-1 text-sm font-semibold text-[var(--sea-ink)]">
              Foods ({meal.foods.length})
            </h3>
            {meal.foods.map((food) => (
              <div key={food.id} className="island-shell rounded-2xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--sea-ink)]">{food.name}</p>
                    {food.portionDescription && (
                      <p className="text-xs text-[var(--sea-ink-soft)]">{food.portionDescription}</p>
                    )}
                    <div className="mt-2 flex gap-3">
                      <span className="text-xs text-[var(--sea-ink-soft)]">
                        P: {Math.round(parseFloat(food.protein ?? '0') * 10) / 10}g
                      </span>
                      <span className="text-xs text-[var(--sea-ink-soft)]">
                        C: {Math.round(parseFloat(food.carbs ?? '0') * 10) / 10}g
                      </span>
                      <span className="text-xs text-[var(--sea-ink-soft)]">
                        F: {Math.round(parseFloat(food.fat ?? '0') * 10) / 10}g
                      </span>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-[var(--sea-ink)]">
                    {Math.round(parseFloat(food.calories))} kcal
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Image lightbox */}
      {showLightbox && meal?.imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowLightbox(false)}
        >
          <button
            type="button"
            onClick={() => setShowLightbox(false)}
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <img
            src={meal.imageUrl}
            alt="Meal"
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="island-shell rise-in mx-4 w-full max-w-sm rounded-2xl p-6">
            <h3 className="mb-2 text-base font-bold text-[var(--sea-ink)]">Delete this meal?</h3>
            <p className="mb-5 text-sm text-[var(--sea-ink-soft)]">
              This will permanently delete the meal and all its food entries. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] py-2.5 text-sm font-medium text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={isDeleting}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-60"
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NutrientCard({
  label,
  value,
  unit,
  large,
}: {
  label: string
  value: number
  unit: string
  large?: boolean
}) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-[var(--chip-bg)] p-2 text-center">
      <span className={`font-bold text-[var(--sea-ink)] ${large ? 'text-xl' : 'text-base'}`}>
        {value}
      </span>
      <span className="text-xs text-[var(--sea-ink-soft)]">{unit}</span>
      <span className="text-xs text-[var(--sea-ink-soft)]">{label}</span>
    </div>
  )
}
