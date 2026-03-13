import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import AnalyzingScreen from '#/components/log/AnalyzingScreen'
import FoodReviewList from '#/components/log/FoodReviewList'
import ImagePicker from '#/components/log/ImagePicker'
import MealTagPicker from '#/components/log/MealTagPicker'
import NutritionSummaryBar from '#/components/log/NutritionSummaryBar'
import { analyzeImageFn, analyzePromptFn, saveMealFn } from '#/lib/server/meals'
import { getMealUploadUrlFn } from '#/lib/server/upload'
import type { AnalyzedFood } from '#/lib/types'

export const Route = createFileRoute('/_authenticated/log')({
  component: LogMealPage,
})

type Step = 'pick' | 'analyzing' | 'review'

function LogMealPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('pick')
  const [foods, setFoods] = useState<AnalyzedFood[]>([])
  const [tag, setTag] = useState<string>('lunch')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [retryData, setRetryData] = useState<{ base64: string; mimeType: string } | null>(null)
  const [imageData, setImageData] = useState<{ base64: string; mimeType: string } | null>(null)

  const handleImage = async (base64: string, mimeType: string) => {
    setRetryData({ base64, mimeType })
    setImageData({ base64, mimeType })
    setError(null)
    setStep('analyzing')

    try {
      const result = await analyzeImageFn({
        data: { imageBase64: base64, mimeType: mimeType as 'image/jpeg' | 'image/png' | 'image/webp' },
      })

      if (result.error && result.foods.length === 0) {
        setError(result.error)
        setStep('pick')
        return
      }

      setFoods(result.foods)
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

      setFoods(result.foods)
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

  const uploadImageToR2 = async (base64: string, mimeType: string): Promise<string | null> => {
    const date = new Date().toISOString().split('T')[0]!
    const fileName = `meal_${Date.now()}`
    const { presignedUrl, publicUrl } = await getMealUploadUrlFn({
      data: { fileName, contentType: mimeType as 'image/jpeg' | 'image/png' | 'image/webp', date },
    })

    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    const blob = new Blob([bytes], { type: mimeType })

    const res = await fetch(presignedUrl, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': mimeType },
    })

    if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
    return publicUrl
  }

  const handleSave = async () => {
    if (foods.length === 0) return
    setIsSaving(true)
    try {
      let imageUrl: string | undefined
      if (imageData) {
        const url = await uploadImageToR2(imageData.base64, imageData.mimeType)
        imageUrl = url ?? undefined
      }

      await saveMealFn({
        data: {
          tag: tag as 'breakfast' | 'lunch' | 'dinner' | 'snacks',
          foods,
          imageUrl,
        },
      })
      await navigate({ to: '/', search: { saved: true } })
    } catch {
      setError('Failed to save meal. Please try again.')
      setIsSaving(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col">
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
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950">
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
          </div>
        )}

        {step === 'analyzing' && <AnalyzingScreen />}

        {step === 'review' && (
          <div className="rise-in space-y-4 pb-28">
            <NutritionSummaryBar foods={foods} />

            <div className="space-y-1">
              <h2 className="px-1 text-sm font-semibold text-[var(--sea-ink)]">Meal type</h2>
              <MealTagPicker value={tag} onChange={setTag} />
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
        <div className="fixed bottom-0 left-0 right-0 border-t border-[var(--line)] bg-[var(--header-bg)] p-4 backdrop-blur-lg">
          <button
            type="button"
            disabled={isSaving || foods.length === 0}
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
