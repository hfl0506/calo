import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useReducer, useState } from 'react'
import AnalyzingScreen from '#/components/log/AnalyzingScreen'
import FoodReviewList from '#/components/log/FoodReviewList'
import ImagePicker from '#/components/log/ImagePicker'
import MealTagPicker from '#/components/log/MealTagPicker'
import NutritionSummaryBar from '#/components/log/NutritionSummaryBar'
import { analyzeImageFn, analyzePromptFn, recalculateNutritionFn, saveMealFn } from '#/lib/server/meals'
import { getMealUploadUrlFn } from '#/lib/server/upload'
import { getUserSettingsFn } from '#/lib/server/settings'
import { useRecentFoods, saveRecentFoods, recentFoodToAnalyzed } from '#/lib/recent-foods'
import type { AnalyzedFood, MealTag } from '#/lib/types'
import type { ImageMimeType } from '#/components/log/ImagePicker'
import { generateId } from '#/lib/uuid'
import { getClientTimezone } from '#/lib/timezone'
import { RouteErrorBoundary } from '#/components/RouteErrorBoundary'
import { AlertTriangle, X } from 'lucide-react'

const withIds = (foods: AnalyzedFood[]): AnalyzedFood[] =>
  foods.map((f) => ({ ...f, id: f.id ?? generateId() }))

export const Route = createFileRoute('/_authenticated/log')({
  loader: async () => {
    const settings = await getUserSettingsFn()
    return { dailyGoal: settings.dailyCalorieGoal }
  },
  component: LogMealPage,
  errorComponent: ({ error, reset }) => <RouteErrorBoundary error={error} reset={reset} />,
})

// ── State machine ──

type Step = 'pick' | 'analyzing' | 'review'

interface LogState {
  step: Step
  foods: AnalyzedFood[]
  error: string | null
  imageData: { base64: string; mimeType: ImageMimeType } | null
  retryData: { base64: string; mimeType: ImageMimeType } | null
}

type LogAction =
  | { type: 'START_IMAGE_ANALYSIS'; base64: string; mimeType: ImageMimeType }
  | { type: 'START_PROMPT_ANALYSIS' }
  | { type: 'ANALYSIS_SUCCESS'; foods: AnalyzedFood[] }
  | { type: 'ANALYSIS_ERROR'; error: string }
  | { type: 'SET_FOODS'; foods: AnalyzedFood[] }
  | { type: 'SET_FOODS_FROM_RECENT'; foods: AnalyzedFood[] }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'CLEAR_ERROR' }

const initialState: LogState = {
  step: 'pick',
  foods: [],
  error: null,
  imageData: null,
  retryData: null,
}

function logReducer(state: LogState, action: LogAction): LogState {
  switch (action.type) {
    case 'START_IMAGE_ANALYSIS':
      return {
        ...state,
        step: 'analyzing',
        error: null,
        imageData: { base64: action.base64, mimeType: action.mimeType },
        retryData: { base64: action.base64, mimeType: action.mimeType },
      }
    case 'START_PROMPT_ANALYSIS':
      return {
        ...state,
        step: 'analyzing',
        error: null,
        imageData: null,
        retryData: null,
      }
    case 'ANALYSIS_SUCCESS':
      return { ...state, step: 'review', foods: action.foods, error: null }
    case 'ANALYSIS_ERROR':
      return { ...state, step: 'pick', error: action.error }
    case 'SET_FOODS':
      return { ...state, foods: action.foods }
    case 'SET_FOODS_FROM_RECENT':
      return { ...state, step: 'review', foods: action.foods }
    case 'SET_ERROR':
      return { ...state, error: action.error }
    case 'CLEAR_ERROR':
      return { ...state, error: null }
    default:
      return state
  }
}

// ── Component ──

function LogMealPage() {
  const navigate = useNavigate()
  const { dailyGoal } = Route.useLoaderData()
  const [state, dispatch] = useReducer(logReducer, initialState)
  const [tag, setTag] = useState<MealTag>('lunch')
  const recentFoods = useRecentFoods()
  const [notes, setNotes] = useState('')
  const [loggedAt, setLoggedAt] = useState('')
  const [adjustmentPrompt, setAdjustmentPrompt] = useState('')
  const [isAdjusting, setIsAdjusting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const { step, foods, error, imageData, retryData } = state

  const handleImage = async (base64: string, mimeType: ImageMimeType) => {
    dispatch({ type: 'START_IMAGE_ANALYSIS', base64, mimeType })

    try {
      const result = await analyzeImageFn({
        data: { imageBase64: base64, mimeType },
      })
      dispatch({ type: 'ANALYSIS_SUCCESS', foods: withIds(result.foods) })
    } catch (err) {
      dispatch({
        type: 'ANALYSIS_ERROR',
        error: err instanceof Error ? err.message : 'Failed to analyze image. Please try again.',
      })
    }
  }

  const handlePrompt = async (prompt: string) => {
    dispatch({ type: 'START_PROMPT_ANALYSIS' })

    try {
      const result = await analyzePromptFn({ data: { prompt } })
      dispatch({ type: 'ANALYSIS_SUCCESS', foods: withIds(result.foods) })
    } catch (err) {
      dispatch({
        type: 'ANALYSIS_ERROR',
        error: err instanceof Error ? err.message : 'Failed to analyze your description. Please try again.',
      })
    }
  }

  const handleRetry = () => {
    if (retryData) {
      void handleImage(retryData.base64, retryData.mimeType)
    }
  }

  const handleAdjustment = async () => {
    if (!adjustmentPrompt.trim() || foods.length === 0) return
    setIsAdjusting(true)
    try {
      const updatedFoods = await Promise.all(
        foods.map(async (food) => {
          const result = await recalculateNutritionFn({
            data: {
              originalName: food.name,
              adjustmentPrompt: adjustmentPrompt.trim(),
              portionDescription: food.portionDescription,
            },
          })
          if (result.food) {
            return {
              ...result.food,
              portionDescription: result.food.portionDescription ?? food.portionDescription,
            }
          }
          return food
        }),
      )
      dispatch({ type: 'SET_FOODS', foods: updatedFoods })
      setAdjustmentPrompt('')
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Failed to adjust nutrition. Please try again.',
      })
    } finally {
      setIsAdjusting(false)
    }
  }

  const uploadImageToR2 = async (base64: string, mimeType: ImageMimeType): Promise<string | null> => {
    const tz = getClientTimezone()
    const date = new Date().toLocaleDateString('en-CA', { timeZone: tz })
    const fileName = `meal_${generateId()}`
    const { presignedUrl, publicUrl } = await getMealUploadUrlFn({
      data: { fileName, contentType: mimeType, date },
    })

    let blob: Blob
    try {
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      blob = new Blob([bytes], { type: mimeType })
    } catch {
      throw new Error('Failed to encode image data')
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    let res: Response
    try {
      res = await fetch(presignedUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': mimeType },
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
    return publicUrl
  }

  const handleSave = async () => {
    if (foods.length === 0 || isSaving) return
    setIsSaving(true)
    navigator.vibrate?.(10)

    const savedFoods = foods
    const savedImageData = imageData
    saveRecentFoods(savedFoods)

    try {
      let imageUrl: string | undefined
      if (savedImageData) {
        const url = await uploadImageToR2(savedImageData.base64, savedImageData.mimeType)
        imageUrl = url ?? undefined
      }

      let loggedAtISO: string | undefined
      if (loggedAt) {
        loggedAtISO = new Date(loggedAt).toISOString()
      }

      await saveMealFn({
        data: {
          tag,
          foods: savedFoods,
          imageUrl,
          notes: notes.trim() || undefined,
          loggedAt: loggedAtISO,
        },
      })

      await navigate({ to: '/', search: { saved: true } })
    } catch {
      await navigate({ to: '/', search: { saveError: true } })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Page header */}
      <div className="flex h-12 items-center justify-between border-b border-[var(--line)] bg-[var(--header-bg)] px-4">
        <h1 className="text-base font-semibold text-[var(--sea-ink)]">Log Meal</h1>
        <button
          type="button"
          onClick={() => void navigate({ to: '/' })}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--sea-ink-soft)] transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
          aria-label="Cancel"
        >
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4">
        {error && step !== 'analyzing' && (
          <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            {retryData && (
              <button
                type="button"
                onClick={handleRetry}
                className="mt-2 text-sm font-medium text-red-700 underline dark:text-red-300"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {step === 'pick' && (
          <div className="rise-in">
            <p className="mb-4 text-center text-sm text-[var(--sea-ink-soft)]">
              Snap a photo or describe your meal to get calorie estimates.
            </p>
            <ImagePicker
              onImage={(base64, mimeType) => void handleImage(base64, mimeType)}
              onPrompt={(prompt) => void handlePrompt(prompt)}
            />

            {recentFoods.length > 0 && (
              <div className="mt-6">
                <h2 className="mb-2 px-1 text-sm font-semibold text-[var(--sea-ink)]">Recently logged</h2>
                <div className="flex flex-wrap gap-2">
                  {recentFoods.map((f) => (
                    <button
                      key={f.name}
                      type="button"
                      onClick={() => {
                        dispatch({ type: 'SET_FOODS_FROM_RECENT', foods: [recentFoodToAnalyzed(f)] })
                      }}
                      className="flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-1.5 text-xs font-medium text-[var(--sea-ink)] transition hover:border-[var(--lagoon-deep)] hover:text-[var(--lagoon-deep)]"
                    >
                      <span>{f.name}</span>
                      <span className="text-[var(--sea-ink-soft)]">{Math.round(f.calories)} kcal</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'analyzing' && <AnalyzingScreen />}

        {step === 'review' && (
          <div className="rise-in space-y-4 pb-28">
            <NutritionSummaryBar foods={foods} />

            {foods.reduce((s, f) => s + f.calories, 0) > dailyGoal && (
              <div role="alert" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950">
                <AlertTriangle size={16} className="shrink-0 text-amber-500" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  This meal exceeds your daily goal of {dailyGoal} kcal
                </p>
              </div>
            )}

            <div className="space-y-1">
              <h2 className="px-1 text-sm font-semibold text-[var(--sea-ink)]">Meal type</h2>
              <MealTagPicker value={tag} onChange={setTag} />
            </div>

            {/* Date & Time */}
            <div className="space-y-1">
              <h2 className="px-1 text-sm font-semibold text-[var(--sea-ink)]">
                Date & Time <span className="font-normal text-[var(--sea-ink-soft)]">(defaults to now)</span>
              </h2>
              <input
                type="datetime-local"
                value={loggedAt}
                onChange={(e) => setLoggedAt(e.target.value)}
                max={new Date().toISOString().slice(0, 16)}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-2 text-sm text-[var(--sea-ink)] outline-none transition focus:border-[var(--lagoon-deep)]"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <h2 className="px-1 text-sm font-semibold text-[var(--sea-ink)]">
                Notes <span className="font-normal text-[var(--sea-ink-soft)]">(optional)</span>
              </h2>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Restaurant name, mood, context…"
                className="w-full resize-none rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-2 text-sm text-[var(--sea-ink)] outline-none transition focus:border-[var(--lagoon-deep)] placeholder:text-[var(--sea-ink-soft)]"
              />
            </div>

            {/* Central adjustment prompt */}
            <div className="space-y-2">
              <h2 className="px-1 text-sm font-semibold text-[var(--sea-ink)]">Adjustments</h2>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={adjustmentPrompt}
                  onChange={(e) => setAdjustmentPrompt(e.target.value)}
                  disabled={isAdjusting}
                  placeholder="e.g. coke zero, half of it, skip rice"
                  className="flex-1 rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-2 text-base text-[var(--sea-ink)] outline-none transition focus:border-[var(--lagoon-deep)] placeholder:text-[var(--sea-ink-soft)] disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => void handleAdjustment()}
                  disabled={isAdjusting || !adjustmentPrompt.trim()}
                  className="rounded-xl bg-[var(--lagoon-deep)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
                >
                  {isAdjusting ? '↻' : 'Apply'}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <h2 className="px-1 text-sm font-semibold text-[var(--sea-ink)]">
                Foods ({foods.length})
              </h2>
              <FoodReviewList foods={foods} onChange={(f) => dispatch({ type: 'SET_FOODS', foods: f })} />
            </div>
          </div>
        )}
      </div>

      {/* Save button fixed to bottom (only on review step) */}
      {step === 'review' && (
        <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 border-t border-[var(--line)] bg-[var(--header-bg)] p-4 backdrop-blur-lg">
          <button
            type="button"
            disabled={foods.length === 0 || isSaving}
            onClick={() => void handleSave()}
            className="w-full rounded-xl bg-[var(--lagoon-deep)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : `Save Meal (${Math.round(foods.reduce((s, f) => s + f.calories, 0))} kcal)`}
          </button>
        </div>
      )}
    </div>
  )
}
