import { useSyncExternalStore } from 'react'
import type { AnalyzedFood } from '#/lib/types'
import { generateId } from '#/lib/uuid'

const STORAGE_KEY = 'recent_foods'
const MAX_ITEMS = 12

export interface RecentFood {
  name: string
  portionDescription: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  lastUsed: number // timestamp
}

const subscribers = new Set<() => void>()

function subscribeToRecentFoods(cb: () => void) {
  subscribers.add(cb)
  return () => subscribers.delete(cb)
}

function notifySubscribers() {
  subscribers.forEach((cb) => cb())
}

// Memoize the parsed result so useSyncExternalStore gets a stable reference
// when the underlying data hasn't changed. JSON.parse() always returns a new
// object, which would cause React to detect a "changed" snapshot on every call
// and loop infinitely.
let _cachedRaw: string | null | undefined = undefined
let _cachedFoods: RecentFood[] = []

export function getRecentFoods(): RecentFood[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === _cachedRaw) return _cachedFoods
    _cachedRaw = raw
    const parsed: unknown = raw ? JSON.parse(raw) : null
    _cachedFoods = Array.isArray(parsed) ? (parsed as RecentFood[]) : []
    return _cachedFoods
  } catch {
    return _cachedFoods
  }
}

export function saveRecentFoods(foods: AnalyzedFood[]): void {
  try {
    const existing = getRecentFoods()
    const now = Date.now()

    // Merge: new foods override existing by name (case-insensitive)
    const map = new Map<string, RecentFood>()
    for (const f of existing) {
      map.set(f.name.toLowerCase(), f)
    }
    for (const f of foods) {
      if (!f.name.trim()) continue
      map.set(f.name.toLowerCase(), {
        name: f.name,
        portionDescription: f.portionDescription ?? '',
        calories: f.calories,
        protein: f.protein ?? 0,
        carbs: f.carbs ?? 0,
        fat: f.fat ?? 0,
        fiber: f.fiber ?? 0,
        lastUsed: now,
      })
    }

    // Sort by most recent, keep top MAX_ITEMS
    const sorted = Array.from(map.values())
      .sort((a, b) => b.lastUsed - a.lastUsed)
      .slice(0, MAX_ITEMS)

    localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted))
    notifySubscribers()
  } catch {
    // localStorage unavailable (SSR, private browsing) — ignore silently
  }
}

export function removeRecentFood(name: string): void {
  try {
    const foods = getRecentFoods().filter(
      (f) => f.name.toLowerCase() !== name.toLowerCase(),
    )
    localStorage.setItem(STORAGE_KEY, JSON.stringify(foods))
    notifySubscribers()
  } catch { /* ignore */ }
}

export function clearRecentFoods(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    notifySubscribers()
  } catch { /* ignore */ }
}

// Returns the localStorage value on the client, empty array on the server.
// Avoids the useEffect(setState, []) flash warning.
export function useRecentFoods(): RecentFood[] {
  return useSyncExternalStore(subscribeToRecentFoods, getRecentFoods, (): RecentFood[] => [])
}

export function recentFoodToAnalyzed(f: RecentFood): AnalyzedFood {
  return {
    id: generateId(),
    name: f.name,
    portionDescription: f.portionDescription,
    calories: f.calories,
    protein: f.protein,
    carbs: f.carbs,
    fat: f.fat,
    fiber: f.fiber,
  }
}
