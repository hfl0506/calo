import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { deleteMealFn, getMealDetailFn, updateMealFn } from '#/lib/server/meals'
import { getCachedMealDetail } from '#/lib/meal-prefetch-cache'
import { MealDetailSkeleton } from '#/components/SkeletonCard'
import FoodReviewList from '#/components/log/FoodReviewList'
import NutritionSummaryBar from '#/components/log/NutritionSummaryBar'
import { UndoToast } from '#/components/UndoToast'
import { NutrientCard } from '#/components/NutrientCard'
import { formatDateTime } from '#/lib/format'
import { parseNutritionValue, roundMacro } from '#/lib/nutrition'
import { MEAL_TAG_EMOJI, MEAL_TAG_LABEL } from '#/lib/types'
import type { AnalyzedFood } from '#/lib/types'

export const Route = createFileRoute('/_authenticated/history/$mealId')({
  component: MealDetailPage,
})

type MealDetail = Awaited<ReturnType<typeof getMealDetailFn>>

function mealFoodsToAnalyzed(foods: MealDetail['foods']): AnalyzedFood[] {
  return foods.map((f) => ({
    id: String(f.id),
    name: f.name,
    portionDescription: f.portionDescription ?? '',
    calories: parseNutritionValue(f.calories),
    protein: parseNutritionValue(f.protein),
    carbs: parseNutritionValue(f.carbs),
    fat: parseNutritionValue(f.fat),
    fiber: 0,
  }))
}

function MealDetailPage() {
  const { mealId } = Route.useParams()
  const navigate = useNavigate()
  const cached = getCachedMealDetail(mealId)
  const [meal, setMeal] = useState<MealDetail | null>(cached)
  const [isLoading, setIsLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showUndoToast, setShowUndoToast] = useState(false)
  const [showLightbox, setShowLightbox] = useState(false)

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editFoods, setEditFoods] = useState<AnalyzedFood[]>([])
  const [editNotes, setEditNotes] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  useEffect(() => {
    getMealDetailFn({ data: { mealId } })
      .then((data) => setMeal(data))
      .catch((err) => { if (!cached) setError(err instanceof Error ? err.message : 'Failed to load meal') })
      .finally(() => setIsLoading(false))
  }, [mealId])

  const enterEditMode = () => {
    if (!meal) return
    setEditFoods(mealFoodsToAnalyzed(meal.foods))
    setEditNotes(meal.notes ?? '')
    setEditError(null)
    setIsEditing(true)
  }

  const handleSaveEdit = async () => {
    if (editFoods.length === 0 || isSavingEdit) return
    setIsSavingEdit(true)
    setEditError(null)
    try {
      await updateMealFn({
        data: {
          mealId,
          notes: editNotes.trim() || undefined,
          foods: editFoods,
        },
      })
      // Refetch updated meal
      const updated = await getMealDetailFn({ data: { mealId } })
      setMeal(updated)
      setIsEditing(false)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const executeDelete = async () => {
    try {
      await deleteMealFn({ data: { mealId } })
      await navigate({ to: '/history' })
    } catch (err) {
      setShowUndoToast(false)
      setError(err instanceof Error ? err.message : 'Failed to delete meal')
    }
  }

  const handleDelete = () => {
    navigator.vibrate?.(10)
    setShowDeleteConfirm(false)
    setShowUndoToast(true)
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
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-[var(--sea-ink)]">
            {isEditing ? 'Edit Meal' : 'Meal Detail'}
          </h1>
        </div>

        {meal && !isEditing && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={enterEditMode}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] text-[var(--sea-ink-soft)] transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
              aria-label="Edit meal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500 text-white transition hover:bg-red-600"
              aria-label="Delete meal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <MealDetailSkeleton />
      ) : error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      ) : meal ? (
        isEditing ? (
          /* ── EDIT MODE ── */
          <div className="rise-in space-y-4 pb-28">
            <NutritionSummaryBar foods={editFoods} />

            {/* Notes */}
            <div className="space-y-1">
              <h2 className="px-1 text-sm font-semibold text-[var(--sea-ink)]">
                Notes <span className="font-normal text-[var(--sea-ink-soft)]">(optional)</span>
              </h2>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Restaurant name, mood, context…"
                className="w-full resize-none rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-2 text-sm text-[var(--sea-ink)] outline-none transition focus:border-[var(--lagoon-deep)] placeholder:text-[var(--sea-ink-soft)]"
              />
            </div>

            <div className="space-y-1">
              <h2 className="px-1 text-sm font-semibold text-[var(--sea-ink)]">Foods ({editFoods.length})</h2>
              <FoodReviewList foods={editFoods} onChange={setEditFoods} />
            </div>

            {editError && (
              <p role="alert" className="text-center text-sm text-red-500">{editError}</p>
            )}

            {/* Action bar */}
            <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 flex gap-3 border-t border-[var(--line)] bg-[var(--header-bg)] p-4 backdrop-blur-lg">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={isSavingEdit}
                className="flex-1 rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] py-3 text-sm font-semibold text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveEdit()}
                disabled={editFoods.length === 0 || isSavingEdit}
                className="flex-1 rounded-xl bg-[var(--lagoon-deep)] py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                {isSavingEdit ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : (
          /* ── VIEW MODE ── */
          <div className="rise-in space-y-4">
            {/* Meal header card */}
            <div className="island-shell rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{MEAL_TAG_EMOJI[meal.tag]}</span>
                <div>
                  <h2 className="text-lg font-bold text-[var(--sea-ink)]">{MEAL_TAG_LABEL[meal.tag]}</h2>
                  <p className="text-sm text-[var(--sea-ink-soft)]">{formatDateTime(meal.loggedAt)}</p>
                </div>
              </div>
            </div>

            {/* Notes */}
            {meal.notes && (
              <div className="island-shell rounded-2xl px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">Notes</p>
                <p className="mt-1 text-sm text-[var(--sea-ink)]">{meal.notes}</p>
              </div>
            )}

            {/* Image if available */}
            {meal.imageUrl && (
              <button
                type="button"
                onClick={() => setShowLightbox(true)}
                className="island-shell w-full overflow-hidden rounded-2xl"
              >
                <img
                  src={meal.imageUrl}
                  alt={MEAL_TAG_LABEL[meal.tag]}
                  className="h-48 w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </button>
            )}

            {/* Nutrition totals */}
            <div className="island-shell rounded-2xl p-4">
              <h3 className="mb-3 text-sm font-semibold text-[var(--sea-ink)]">Nutrition Totals</h3>
              <div className="grid grid-cols-4 gap-3">
                <NutrientCard label="Calories" value={Math.round(meal.totals.calories)} unit="kcal" large />
                <NutrientCard label="Protein" value={roundMacro(meal.totals.protein)} unit="g" />
                <NutrientCard label="Carbs" value={roundMacro(meal.totals.carbs)} unit="g" />
                <NutrientCard label="Fat" value={roundMacro(meal.totals.fat)} unit="g" />
              </div>
            </div>

            {/* Food list */}
            <div className="space-y-2">
              <h3 className="px-1 text-sm font-semibold text-[var(--sea-ink)]">Foods ({meal.foods.length})</h3>
              {meal.foods.map((food) => (
                <div key={food.id} className="island-shell rounded-2xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--sea-ink)]">{food.name}</p>
                      {food.portionDescription && (
                        <p className="text-xs text-[var(--sea-ink-soft)]">{food.portionDescription}</p>
                      )}
                      <div className="mt-2 flex gap-3">
                        <span className="text-xs text-[var(--sea-ink-soft)]">P: {roundMacro(parseNutritionValue(food.protein))}g</span>
                        <span className="text-xs text-[var(--sea-ink-soft)]">C: {roundMacro(parseNutritionValue(food.carbs))}g</span>
                        <span className="text-xs text-[var(--sea-ink-soft)]">F: {roundMacro(parseNutritionValue(food.fat))}g</span>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-[var(--sea-ink)]">
                      {Math.round(parseNutritionValue(food.calories))} kcal
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : null}

      {/* Image lightbox */}
      {showLightbox && meal?.imageUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Meal image lightbox"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowLightbox(false) }}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowLightbox(false) }}
        >
          <button
            type="button"
            onClick={() => setShowLightbox(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <img src={meal.imageUrl} alt="Meal" className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain" />
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="island-shell rise-in mx-4 w-full max-w-sm rounded-2xl p-6">
            <h3 className="mb-2 text-base font-bold text-[var(--sea-ink)]">Delete this meal?</h3>
            <p className="mb-5 text-sm text-[var(--sea-ink-soft)]">
              You can undo the deletion for 5 seconds after confirming.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] py-2.5 text-sm font-medium text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo toast */}
      {showUndoToast && (
        <UndoToast
          message="Meal deleted"
          onUndo={() => setShowUndoToast(false)}
          onDismiss={() => void executeDelete()}
        />
      )}
    </div>
  )
}

