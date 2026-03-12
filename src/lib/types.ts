export type MealTag = 'breakfast' | 'lunch' | 'dinner' | 'snacks'

export interface AnalyzedFood {
  name: string
  portionDescription: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

export interface MealFood {
  id: number
  mealId: string
  name: string
  portionDescription: string | null
  calories: string
  protein: string | null
  carbs: string | null
  fat: string | null
  fiber: string | null
  createdAt: Date | null
}

export interface Meal {
  id: string
  userId: string
  tag: MealTag
  loggedAt: Date | null
  imageUrl: string | null
  notes: string | null
  createdAt: Date | null
  foods: MealFood[]
  totals: {
    calories: number
    protein: number
    carbs: number
    fat: number
  }
}
