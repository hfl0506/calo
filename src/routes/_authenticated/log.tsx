import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
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
import { RouteErrorBoundary } from '#/components/RouteErrorBoundary'

const withIds = (foods: AnalyzedFood[]): AnalyzedFood[] =>
  foods.map((f) => ({ ...f, id: f.id ?? generateId() }))

export const Route = createFileRoute('/_authenticated/log')({
  component: LogMealPage,
  errorComponent: ({ error, reset }) => <RouteErrorBoundary error={error} reset={reset} />,
})

type Step = 'pick' | 'analyzing' | 'review'

function LogMealPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('pick')
  const [foods, setFoods] = useState<AnalyzedFood[]>([])
  const [tag, setTag] = useState<MealTag>('lunch')
  const [error, setError] = useState<string | null>(null)
  const [retryData, setRetryData] = useState<{ base64: string; mimeType: ImageMimeType } | null>(null)
  const [imageData, setImageData] = useState<{ base64: string; mimeType: ImageMimeType } | null>(null)
  const recentFoods = useRecentFoods()
  const [notes, setNotes] = useState('')
  const [loggedAt, setLoggedAt] = useState('')
  const [adjustmentPrompt, setAdjustmentPrompt] = useState('')
  const [isAdjusting, setIsAdjusting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [dailyGoal, setDailyGoal] = useState<number | null>(null)

  // Fetch daily goal once so we can warn if the review total exceeds it
  useEffect(() => {
    getUserSettingsFn().then((s) => setDailyGoal(s.dailyCalorieGoal)).catch((err) => {
      console.warn('[log] Failed to fetch daily goal:', err)
    })
  }, [])

  const handleImage = async (base64: string, mimeType: ImageMimeType) => {
    setRetryData({ base64, mimeType })
    setImageData({ base64, mimeType })
    setError(null)
    setStep('analyzing')

    try {
      const result = await analyzeImageFn({
        data: { imageBase64: base64, mimeType },
      })

      if (result.error && result.foods.length === 0) {
        setError(result.error)
        setStep('pick')
        return
      }

      setFoods(withIds(result.foods))
      setStep('review')
    } catch {
      setError('Failed to analyze image. Please try again.')
      setStep('pick')
    }
  }

  const handlePrompt = async (prompt: string) => {
    setError(null)
    setImageData(null)
    setRetryData(null)
    setStep('analyzing')

    try {
      const result = await analyzePromptFn({ data: { prompt } })

      if (result.error && result.foods.length === 0) {
        setError(result.error)
        setStep('pick')
        return
      }

      setFoods(withIds(result.foods))
      setStep('review')
    } catch {
      setError('Failed to analyze your description. Please try again.')
      setStep('pick')
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
      setFoods(updatedFoods)
      setAdjustmentPrompt('')
    } catch (err) {
      console.error('Failed to adjust:', err)
    } finally {
      setIsAdjusting(false)
    }
  }

  const uploadImageToR2 = async (base64: string, mimeType: ImageMimeType): Promise<string | null> => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const date = new Date().toLocaleDateString('en-CA', { timeZone: tz })
    const fileName = `meal_${generateId()}`
    const { presignedUrl, publicUrl } = await getMealUploadUrlFn({
      data: { fileName, contentType: mimeType, date },
    })

    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    const blob = new Blob([bytes], { type: mimeType })

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

      // Convert datetime-local value (no tz) to ISO string in user's local timezone
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
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
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
                        setFoods([recentFoodToAnalyzed(f)])
                        setStep('review')
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

            {dailyGoal !== null && foods.reduce((s, f) => s + f.calories, 0) > dailyGoal && (
              <div role="alert" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-amber-500">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
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
              <FoodReviewList foods={foods} onChange={setFoods} />
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
