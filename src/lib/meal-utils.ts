import type { Meal } from '#/lib/types'

export function groupMealsByDate(meals: Meal[], tz: string): Record<string, Meal[]> {
  const grouped: Record<string, Meal[]> = {}
  for (const meal of meals) {
    if (!meal.loggedAt) continue
    const dateStr = new Date(meal.loggedAt).toLocaleDateString('en-CA', { timeZone: tz })
    if (!grouped[dateStr]) grouped[dateStr] = []
    grouped[dateStr].push(meal)
  }
  return grouped
}
