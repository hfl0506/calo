import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import ThemeToggle from '#/components/ThemeToggle'
import { authClient } from '#/lib/auth-client'
import { clearPrefetchCache } from '#/lib/meal-prefetch-cache'
import { getUserSettingsFn, updateUserSettingsFn } from '#/lib/server/settings'
import { SettingsSkeleton } from '#/components/SkeletonCard'
import { useRecentFoods, removeRecentFood, clearRecentFoods } from '#/lib/recent-foods'

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsPage,
})

interface GoalInputProps {
  label: string
  unit: string
  value: number | null
  min: number
  max: number
  onChange: (v: number | null) => void
}

function RecentFoodsManager() {
  const recent = useRecentFoods()

  if (recent.length === 0) {
    return <p className="text-sm text-[var(--sea-ink-soft)]">No recent foods cached.</p>
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        {recent.map((f) => (
          <div
            key={f.name}
            className="flex items-center justify-between rounded-xl bg-[var(--chip-bg)] px-3 py-2"
          >
            <div>
              <span className="text-sm font-medium text-[var(--sea-ink)]">{f.name}</span>
              <span className="ml-2 text-xs text-[var(--sea-ink-soft)]">{Math.round(f.calories)} kcal</span>
            </div>
            <button
              type="button"
              onClick={() => removeRecentFood(f.name)}
              aria-label={`Remove ${f.name} from recent foods`}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--sea-ink-soft)] transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={clearRecentFoods}
        className="w-full rounded-xl border border-red-200 py-2 text-sm font-medium text-red-500 transition hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
      >
        Clear all ({recent.length} item{recent.length !== 1 ? 's' : ''})
      </button>
    </div>
  )
}

function GoalInput({ label, unit, value, min, max, onChange }: GoalInputProps) {
  const [raw, setRaw] = useState(value !== null ? String(value) : '')

  useEffect(() => {
    setRaw(value !== null ? String(value) : '')
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const s = e.target.value
    setRaw(s)
    if (s === '') {
      onChange(null)
    } else {
      const n = parseInt(s, 10)
      if (!Number.isNaN(n)) onChange(n)
    }
  }

  const isInvalid = value !== null && (value < min || value > max)

  return (
    <div className="flex items-center gap-3">
      <span className="w-16 text-sm text-[var(--sea-ink)]">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={1}
        value={raw}
        placeholder="—"
        onChange={handleChange}
        className={`w-24 rounded-xl border bg-[var(--chip-bg)] px-3 py-2 text-center text-base font-semibold text-[var(--sea-ink)] outline-none transition focus:border-[var(--lagoon-deep)] ${
          isInvalid ? 'border-red-400' : 'border-[var(--line)]'
        }`}
      />
      <span className="text-sm text-[var(--sea-ink-soft)]">{unit}</span>
      {isInvalid && (
        <span className="text-xs text-red-500">
          {min}–{max}
        </span>
      )}
    </div>
  )
}

function SettingsPage() {
  const [dailyGoal, setDailyGoal] = useState(2000)
  const [savedDailyGoal, setSavedDailyGoal] = useState(2000)
  const [proteinGoal, setProteinGoal] = useState<number | null>(null)
  const [carbsGoal, setCarbsGoal] = useState<number | null>(null)
  const [fatGoal, setFatGoal] = useState<number | null>(null)
  const [fiberGoal, setFiberGoal] = useState<number | null>(null)
  const [savedMacros, setSavedMacros] = useState<{ p: number | null; c: number | null; f: number | null; fi: number | null }>({ p: null, c: null, f: null, fi: null })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    getUserSettingsFn()
      .then((data) => {
        setDailyGoal(data.dailyCalorieGoal)
        setSavedDailyGoal(data.dailyCalorieGoal)
        setProteinGoal(data.proteinGoal)
        setCarbsGoal(data.carbsGoal)
        setFatGoal(data.fatGoal)
        setFiberGoal(data.fiberGoal)
        setSavedMacros({ p: data.proteinGoal, c: data.carbsGoal, f: data.fatGoal, fi: data.fiberGoal })
      })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [])

  const isDirty =
    dailyGoal !== savedDailyGoal ||
    proteinGoal !== savedMacros.p ||
    carbsGoal !== savedMacros.c ||
    fatGoal !== savedMacros.f ||
    fiberGoal !== savedMacros.fi

  const isCalInvalid = dailyGoal < 500 || dailyGoal > 10000
  const isMacroInvalid =
    (proteinGoal !== null && (proteinGoal < 0 || proteinGoal > 1000)) ||
    (carbsGoal !== null && (carbsGoal < 0 || carbsGoal > 2000)) ||
    (fatGoal !== null && (fatGoal < 0 || fatGoal > 1000)) ||
    (fiberGoal !== null && (fiberGoal < 0 || fiberGoal > 500))

  const handleSave = async () => {
    if (!isDirty || isSaving || isCalInvalid || isMacroInvalid) return
    setIsSaving(true)
    setSaveError(false)
    try {
      await updateUserSettingsFn({
        data: {
          dailyCalorieGoal: dailyGoal,
          proteinGoal: proteinGoal ?? null,
          carbsGoal: carbsGoal ?? null,
          fatGoal: fatGoal ?? null,
          fiberGoal: fiberGoal ?? null,
        },
      })
      setSavedDailyGoal(dailyGoal)
      setSavedMacros({ p: proteinGoal, c: carbsGoal, f: fatGoal, fi: fiberGoal })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setSaveError(true)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="px-4 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--sea-ink)]">Settings</h1>
      </div>

      <div className="space-y-4">
        {/* Goals */}
        <div className="island-shell rounded-2xl p-5">
          <h2 className="mb-1 text-sm font-semibold text-[var(--sea-ink)]">Daily Goals</h2>
          <p className="mb-4 text-xs text-[var(--sea-ink-soft)]">
            Set your calorie target and optional macro goals. Leave macro fields blank to skip.
          </p>

          {isLoading ? (
            <SettingsSkeleton />
          ) : (
            <div className="space-y-3">
              {/* Calorie goal */}
              <div className="flex items-center gap-3">
                <span className="w-16 text-sm text-[var(--sea-ink)]">Calories</span>
                <input
                  type="number"
                  min={500}
                  max={10000}
                  step={50}
                  value={dailyGoal}
                  onChange={(e) => setDailyGoal(Number(e.target.value))}
                  className={`w-24 rounded-xl border bg-[var(--chip-bg)] px-3 py-2 text-center text-base font-semibold text-[var(--sea-ink)] outline-none transition focus:border-[var(--lagoon-deep)] ${
                    isCalInvalid ? 'border-red-400' : 'border-[var(--line)]'
                  }`}
                />
                <span className="text-sm text-[var(--sea-ink-soft)]">kcal</span>
                {isCalInvalid && <span className="text-xs text-red-500">500–10,000</span>}
              </div>

              <div className="my-1 border-t border-[var(--line)]" />

              <GoalInput label="Protein" unit="g" value={proteinGoal} min={0} max={1000} onChange={setProteinGoal} />
              <GoalInput label="Carbs" unit="g" value={carbsGoal} min={0} max={2000} onChange={setCarbsGoal} />
              <GoalInput label="Fat" unit="g" value={fatGoal} min={0} max={1000} onChange={setFatGoal} />
              <GoalInput label="Fiber" unit="g" value={fiberGoal} min={0} max={500} onChange={setFiberGoal} />

              <div className="pt-1">
                <button
                  type="button"
                  disabled={isSaving || !isDirty || isCalInvalid || isMacroInvalid}
                  onClick={() => void handleSave()}
                  className="w-full rounded-xl bg-[var(--lagoon-deep)] py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                >
                  {isSaving ? 'Saving…' : saved ? 'Saved!' : 'Save Goals'}
                </button>
                {saveError && (
                  <p role="alert" className="mt-2 text-center text-xs text-red-500">
                    Failed to save. Please try again.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme */}
        <div className="island-shell rounded-2xl p-5">
          <h2 className="mb-1 text-sm font-semibold text-[var(--sea-ink)]">Appearance</h2>
          <p className="mb-4 text-xs text-[var(--sea-ink-soft)]">
            Switch between light, dark, and auto (system) themes.
          </p>
          <ThemeToggle />
        </div>

        {/* Recent Foods */}
        <div className="island-shell rounded-2xl p-5">
          <h2 className="mb-1 text-sm font-semibold text-[var(--sea-ink)]">Recent Foods</h2>
          <p className="mb-4 text-xs text-[var(--sea-ink-soft)]">
            Foods you log are saved locally for quick re-logging.
          </p>
          <RecentFoodsManager />
        </div>

        {/* Account */}
        <div className="island-shell rounded-2xl p-5">
          <h2 className="mb-4 text-sm font-semibold text-[var(--sea-ink)]">Account</h2>
          <button
            type="button"
            onClick={() => { clearPrefetchCache(); void authClient.signOut() }}
            className="w-full rounded-xl border border-red-200 py-2.5 text-sm font-medium text-red-500 transition hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
