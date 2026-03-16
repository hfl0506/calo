import type { AnalyzedFood } from '#/lib/types'

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

export function getRecentFoods(): RecentFood[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as RecentFood[]
  } catch {
    return []
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
  } catch {
    // localStorage unavailable (SSR, private browsing) — ignore silently
  }
}

export function recentFoodToAnalyzed(f: RecentFood): AnalyzedFood {
  return {
    id: crypto.randomUUID(),
    name: f.name,
    portionDescription: f.portionDescription,
    calories: f.calories,
    protein: f.protein,
    carbs: f.carbs,
    fat: f.fat,
    fiber: f.fiber,
  }
}
