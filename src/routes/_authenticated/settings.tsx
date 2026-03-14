import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import ThemeToggle from '#/components/ThemeToggle'
import { authClient } from '#/lib/auth-client'
import { clearPrefetchCache } from '#/lib/meal-prefetch-cache'
import { getUserSettingsFn, updateUserSettingsFn } from '#/lib/server/settings'

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const [dailyGoal, setDailyGoal] = useState(2000)
  const [savedGoal, setSavedGoal] = useState(2000)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getUserSettingsFn()
      .then((data) => {
        setDailyGoal(data.dailyCalorieGoal)
        setSavedGoal(data.dailyCalorieGoal)
      })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [])

  const handleSaveGoal = async () => {
    if (dailyGoal < 500 || dailyGoal > 10000 || dailyGoal === savedGoal) return
    setIsSaving(true)
    try {
      await updateUserSettingsFn({ data: { dailyCalorieGoal: dailyGoal } })
      setSavedGoal(dailyGoal)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // ignore
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
        {/* Daily Calorie Goal */}
        <div className="island-shell rounded-2xl p-5">
          <h2 className="mb-1 text-sm font-semibold text-[var(--sea-ink)]">Daily Calorie Goal</h2>
          <p className="mb-4 text-xs text-[var(--sea-ink-soft)]">
            Set your target daily calorie intake (500 - 10,000 kcal).
          </p>

          {isLoading ? (
            <div className="flex justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--lagoon-deep)] border-t-transparent" />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={500}
                max={10000}
                step={50}
                value={dailyGoal}
                onChange={(e) => setDailyGoal(Number(e.target.value))}
                className="w-28 rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-2 text-center text-sm font-semibold text-[var(--sea-ink)] outline-none focus:border-[var(--lagoon-deep)]"
              />
              <span className="text-sm text-[var(--sea-ink-soft)]">kcal</span>
              <button
                type="button"
                disabled={isSaving || dailyGoal === savedGoal || dailyGoal < 500 || dailyGoal > 10000}
                onClick={() => void handleSaveGoal()}
                className="ml-auto rounded-xl bg-[var(--lagoon-deep)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                {isSaving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
              </button>
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
