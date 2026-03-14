import type { MealFood } from '#/lib/types'

export function calcTotals(foods: Pick<MealFood, 'calories' | 'protein' | 'carbs' | 'fat'>[]) {
  let calories = 0, protein = 0, carbs = 0, fat = 0
  for (const f of foods) {
    calories += parseFloat(f.calories)
    protein += parseFloat(f.protein ?? '0')
    carbs += parseFloat(f.carbs ?? '0')
    fat += parseFloat(f.fat ?? '0')
  }
  return { calories, protein, carbs, fat }
}
