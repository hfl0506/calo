import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useReducer } from 'react'
import { ChevronLeft, Pencil, Trash2, X } from 'lucide-react'
import { deleteMealFn, getMealDetailFn, updateMealFn } from '#/lib/server/meals'
import { getCachedMealDetail, invalidateCachedMealDetail } from '#/lib/meal-prefetch-cache'
import { MealDetailSkeleton } from '#/components/SkeletonCard'
import FoodReviewList from '#/components/log/FoodReviewList'
import NutritionSummaryBar from '#/components/log/NutritionSummaryBar'
import { UndoToast } from '#/components/UndoToast'
import { NutrientCard } from '#/components/NutrientCard'
import { formatDateTime } from '#/lib/format'
import { parseNutritionValue, roundMacro } from '#/lib/nutrition'
import { MEAL_TAG_EMOJI, MEAL_TAG_LABEL } from '#/lib/types'
import type { AnalyzedFood } from '#/lib/types'
import { RouteErrorBoundary } from '#/components/RouteErrorBoundary'

export const Route = createFileRoute('/_authenticated/history/$mealId')({
  component: MealDetailPage,
  errorComponent: ({ error, reset }) => <RouteErrorBoundary error={error} reset={reset} />,
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
    fiber: parseNutritionValue(f.fiber),
  }))
}

// ── State machine ──

type Mode = 'loading' | 'view' | 'edit'

interface DetailState {
  mode: Mode
  meal: MealDetail | null
  error: string | null
  showDeleteConfirm: boolean
  showUndoToast: boolean
  showLightbox: boolean
  editFoods: AnalyzedFood[]
  editNotes: string
  isSavingEdit: boolean
  editError: string | null
}

type DetailAction =
  | { type: 'LOADED'; meal: MealDetail }
  | { type: 'LOAD_ERROR'; error: string }
  | { type: 'ENTER_EDIT' }
  | { type: 'SET_EDIT_FOODS'; foods: AnalyzedFood[] }
  | { type: 'SET_EDIT_NOTES'; notes: string }
  | { type: 'SAVE_EDIT_START' }
  | { type: 'SAVE_EDIT_SUCCESS'; meal: MealDetail }
  | { type: 'SAVE_EDIT_ERROR'; error: string }
  | { type: 'CANCEL_EDIT' }
  | { type: 'SHOW_DELETE_CONFIRM'; show: boolean }
  | { type: 'START_UNDO_TOAST' }
  | { type: 'CANCEL_UNDO' }
  | { type: 'DELETE_ERROR'; error: string }
  | { type: 'TOGGLE_LIGHTBOX'; show: boolean }
  | { type: 'SET_ERROR'; error: string }

function createInitialState(cached: MealDetail | null): DetailState {
  return {
    mode: cached ? 'view' : 'loading',
    meal: cached,
    error: null,
    showDeleteConfirm: false,
    showUndoToast: false,
    showLightbox: false,
    editFoods: [],
    editNotes: '',
    isSavingEdit: false,
    editError: null,
  }
}

function detailReducer(state: DetailState, action: DetailAction): DetailState {
  switch (action.type) {
    case 'LOADED':
      return { ...state, mode: 'view', meal: action.meal, error: null }
    case 'LOAD_ERROR':
      return { ...state, mode: 'view', error: action.error }
    case 'ENTER_EDIT':
      if (!state.meal) return state
      return {
        ...state,
        mode: 'edit',
        editFoods: mealFoodsToAnalyzed(state.meal.foods),
        editNotes: state.meal.notes ?? '',
        editError: null,
      }
    case 'SET_EDIT_FOODS':
      return { ...state, editFoods: action.foods }
    case 'SET_EDIT_NOTES':
      return { ...state, editNotes: action.notes }
    case 'SAVE_EDIT_START':
      return { ...state, isSavingEdit: true, editError: null }
    case 'SAVE_EDIT_SUCCESS':
      return { ...state, mode: 'view', meal: action.meal, isSavingEdit: false, editError: null }
    case 'SAVE_EDIT_ERROR':
      return { ...state, isSavingEdit: false, editError: action.error }
    case 'CANCEL_EDIT':
      return { ...state, mode: 'view', editError: null }
    case 'SHOW_DELETE_CONFIRM':
      return { ...state, showDeleteConfirm: action.show }
    case 'START_UNDO_TOAST':
      return { ...state, showDeleteConfirm: false, showUndoToast: true }
    case 'CANCEL_UNDO':
      return { ...state, showUndoToast: false }
    case 'DELETE_ERROR':
      return { ...state, showUndoToast: false, error: action.error }
    case 'TOGGLE_LIGHTBOX':
      return { ...state, showLightbox: action.show }
    case 'SET_ERROR':
      return { ...state, error: action.error }
  }
}

// ── Component ──

function MealDetailPage() {
  const { mealId } = Route.useParams()
  const navigate = useNavigate()
  const cached = getCachedMealDetail(mealId)
  const [state, dispatch] = useReducer(detailReducer, cached, createInitialState)

  const { mode, meal, error, showDeleteConfirm, showUndoToast, showLightbox, editFoods, editNotes, isSavingEdit, editError } = state

  useEffect(() => {
    getMealDetailFn({ data: { mealId } })
      .then((data) => dispatch({ type: 'LOADED', meal: data }))
      .catch((err) => {
        if (!cached) dispatch({ type: 'LOAD_ERROR', error: err instanceof Error ? err.message : 'Failed to load meal' })
      })
  }, [mealId])

  const handleSaveEdit = async () => {
    if (editFoods.length === 0 || isSavingEdit) return
    dispatch({ type: 'SAVE_EDIT_START' })
    try {
      await updateMealFn({
        data: {
          mealId,
          notes: editNotes.trim() || undefined,
          foods: editFoods,
        },
      })
      invalidateCachedMealDetail(mealId)
      const updated = await getMealDetailFn({ data: { mealId } })
      dispatch({ type: 'SAVE_EDIT_SUCCESS', meal: updated })
    } catch (err) {
      dispatch({ type: 'SAVE_EDIT_ERROR', error: err instanceof Error ? err.message : 'Failed to save changes' })
    }
  }

  const executeDelete = async () => {
    try {
      await deleteMealFn({ data: { mealId } })
      invalidateCachedMealDetail(mealId)
      await navigate({ to: '/history' })
    } catch (err) {
      dispatch({ type: 'DELETE_ERROR', error: err instanceof Error ? err.message : 'Failed to delete meal' })
    }
  }

  const handleDelete = () => {
    navigator.vibrate?.(10)
    dispatch({ type: 'START_UNDO_TOAST' })
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
            <ChevronLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-[var(--sea-ink)]">
            {mode === 'edit' ? 'Edit Meal' : 'Meal Detail'}
          </h1>
        </div>

        {meal && mode === 'view' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: 'ENTER_EDIT' })}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] text-[var(--sea-ink-soft)] transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
              aria-label="Edit meal"
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'SHOW_DELETE_CONFIRM', show: true })}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500 text-white transition hover:bg-red-600"
              aria-label="Delete meal"
            >
              <Trash2 size={18} />
            </button>
          </div>
        )}
      </div>

      {mode === 'loading' ? (
        <MealDetailSkeleton />
      ) : error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      ) : meal ? (
        mode === 'edit' ? (
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
                onChange={(e) => dispatch({ type: 'SET_EDIT_NOTES', notes: e.target.value })}
                maxLength={500}
                rows={2}
                placeholder="Restaurant name, mood, context…"
                className="w-full resize-none rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-2 text-sm text-[var(--sea-ink)] outline-none transition focus:border-[var(--lagoon-deep)] placeholder:text-[var(--sea-ink-soft)]"
              />
            </div>

            <div className="space-y-1">
              <h2 className="px-1 text-sm font-semibold text-[var(--sea-ink)]">Foods ({editFoods.length})</h2>
              <FoodReviewList foods={editFoods} onChange={(foods) => dispatch({ type: 'SET_EDIT_FOODS', foods })} />
            </div>

            {editError && (
              <p role="alert" className="text-center text-sm text-red-500">{editError}</p>
            )}

            {/* Action bar */}
            <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 flex gap-3 border-t border-[var(--line)] bg-[var(--header-bg)] p-4 backdrop-blur-lg">
              <button
                type="button"
                onClick={() => dispatch({ type: 'CANCEL_EDIT' })}
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
                onClick={() => dispatch({ type: 'TOGGLE_LIGHTBOX', show: true })}
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
          onClick={(e) => { if (e.target === e.currentTarget) dispatch({ type: 'TOGGLE_LIGHTBOX', show: false }) }}
          onKeyDown={(e) => { if (e.key === 'Escape') dispatch({ type: 'TOGGLE_LIGHTBOX', show: false }) }}
        >
          <button
            type="button"
            onClick={() => dispatch({ type: 'TOGGLE_LIGHTBOX', show: false })}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
            aria-label="Close"
          >
            <X size={24} />
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
                onClick={() => dispatch({ type: 'SHOW_DELETE_CONFIRM', show: false })}
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
          onUndo={() => dispatch({ type: 'CANCEL_UNDO' })}
          onDismiss={() => void executeDelete()}
        />
      )}
    </div>
  )
}
