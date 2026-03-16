import type { MealFood } from '#/lib/types'

export function parseNutritionValue(value: string | null | undefined): number {
  const n = parseFloat(value ?? '0')
  return isFinite(n) && n >= 0 ? n : 0
}

export function calcTotals(foods: Pick<MealFood, 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber'>[]) {
  let calories = 0, protein = 0, carbs = 0, fat = 0, fiber = 0
  for (const f of foods) {
    calories += parseNutritionValue(f.calories)
    protein += parseNutritionValue(f.protein)
    carbs += parseNutritionValue(f.carbs)
    fat += parseNutritionValue(f.fat)
    fiber += parseNutritionValue(f.fiber)
  }
  return { calories, protein, carbs, fat, fiber }
}
