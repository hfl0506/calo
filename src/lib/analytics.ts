export interface DayData {
  date: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface WeeklyInsights {
  avgCalories: number
  totalDeficitSurplus: number // positive = surplus, negative = deficit
  loggedDays: number
  macroWarnings: string[]
}

export function computeInsights(
  days: DayData[],
  calorieGoal: number,
  macroGoals: { protein: number | null; carbs: number | null; fat: number | null },
): WeeklyInsights {
  const loggedDays = days.filter((d) => d.calories > 0)

  if (loggedDays.length === 0) {
    return { avgCalories: 0, totalDeficitSurplus: 0, loggedDays: 0, macroWarnings: [] }
  }

  const avgCalories = Math.round(
    loggedDays.reduce((s, d) => s + d.calories, 0) / loggedDays.length,
  )

  const totalDeficitSurplus = Math.round(
    loggedDays.reduce((s, d) => s + (d.calories - calorieGoal), 0),
  )

  const macroWarnings: string[] = []
  if (loggedDays.length >= 3) {
    const avgProtein = loggedDays.reduce((s, d) => s + d.protein, 0) / loggedDays.length
    const avgCarbs = loggedDays.reduce((s, d) => s + d.carbs, 0) / loggedDays.length
    const avgFat = loggedDays.reduce((s, d) => s + d.fat, 0) / loggedDays.length

    if (macroGoals.protein && avgProtein < macroGoals.protein * 0.7)
      macroWarnings.push('Low protein this period')
    if (macroGoals.carbs && avgCarbs < macroGoals.carbs * 0.7)
      macroWarnings.push('Low carbs this period')
    if (macroGoals.fat && avgFat < macroGoals.fat * 0.7)
      macroWarnings.push('Low fat this period')
  }

  return { avgCalories, totalDeficitSurplus, loggedDays: loggedDays.length, macroWarnings }
}
