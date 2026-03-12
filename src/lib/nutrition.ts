import type { MealFood } from '#/lib/types'

export function calcTotals(foods: Pick<MealFood, 'calories' | 'protein' | 'carbs' | 'fat'>[]) {
  return {
    calories: foods.reduce((sum, f) => sum + parseFloat(f.calories), 0),
    protein: foods.reduce((sum, f) => sum + parseFloat(f.protein ?? '0'), 0),
    carbs: foods.reduce((sum, f) => sum + parseFloat(f.carbs ?? '0'), 0),
    fat: foods.reduce((sum, f) => sum + parseFloat(f.fat ?? '0'), 0),
  }
}
