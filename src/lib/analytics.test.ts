import { describe, expect, it } from 'vitest'
import { computeInsights } from './analytics'
import type { DayData } from './analytics'

const day = (date: string, calories: number, protein = 0, carbs = 0, fat = 0): DayData => ({
  date,
  calories,
  protein,
  carbs,
  fat,
})

const noMacroGoals = { protein: null, carbs: null, fat: null }

describe('computeInsights', () => {
  it('returns zeros when no days are logged', () => {
    const result = computeInsights([], 2000, noMacroGoals)
    expect(result).toEqual({ avgCalories: 0, totalDeficitSurplus: 0, loggedDays: 0, macroWarnings: [] })
  })

  it('ignores days with zero calories', () => {
    const days = [day('2026-03-10', 0), day('2026-03-11', 0)]
    const result = computeInsights(days, 2000, noMacroGoals)
    expect(result.loggedDays).toBe(0)
  })

  it('counts only days with calories > 0', () => {
    const days = [day('2026-03-10', 0), day('2026-03-11', 1800), day('2026-03-12', 2200)]
    const result = computeInsights(days, 2000, noMacroGoals)
    expect(result.loggedDays).toBe(2)
  })

  it('calculates average calories correctly', () => {
    const days = [day('2026-03-10', 1800), day('2026-03-11', 2200)]
    const result = computeInsights(days, 2000, noMacroGoals)
    expect(result.avgCalories).toBe(2000)
  })

  it('rounds average calories to nearest integer', () => {
    const days = [day('2026-03-10', 1000), day('2026-03-11', 2000), day('2026-03-12', 1500)]
    const result = computeInsights(days, 2000, noMacroGoals)
    expect(result.avgCalories).toBe(1500)
  })

  it('calculates positive surplus when eating above goal', () => {
    const days = [day('2026-03-10', 2500), day('2026-03-11', 2500)]
    const result = computeInsights(days, 2000, noMacroGoals)
    expect(result.totalDeficitSurplus).toBe(1000) // 500 surplus × 2 days
  })

  it('calculates negative deficit when eating below goal', () => {
    const days = [day('2026-03-10', 1500), day('2026-03-11', 1500)]
    const result = computeInsights(days, 2000, noMacroGoals)
    expect(result.totalDeficitSurplus).toBe(-1000)
  })

  it('returns no macro warnings with fewer than 3 logged days', () => {
    const days = [day('2026-03-10', 2000, 10, 10, 10), day('2026-03-11', 2000, 10, 10, 10)]
    const macroGoals = { protein: 150, carbs: 250, fat: 70 }
    const result = computeInsights(days, 2000, macroGoals)
    expect(result.macroWarnings).toEqual([])
  })

  it('returns no macro warnings when macros meet the 70% threshold', () => {
    const days = [
      day('2026-03-10', 2000, 110, 180, 50),
      day('2026-03-11', 2000, 110, 180, 50),
      day('2026-03-12', 2000, 110, 180, 50),
    ]
    const macroGoals = { protein: 150, carbs: 250, fat: 70 }
    const result = computeInsights(days, 2000, macroGoals)
    // 110 >= 150*0.7=105, 180 >= 250*0.7=175, 50 >= 70*0.7=49 → no warnings
    expect(result.macroWarnings).toEqual([])
  })

  it('warns about low protein when average is below 70% of goal', () => {
    const days = [
      day('2026-03-10', 2000, 50, 200, 60),
      day('2026-03-11', 2000, 50, 200, 60),
      day('2026-03-12', 2000, 50, 200, 60),
    ]
    const macroGoals = { protein: 150, carbs: null, fat: null }
    const result = computeInsights(days, 2000, macroGoals)
    expect(result.macroWarnings).toContain('Low protein this period')
  })

  it('warns about low carbs when average is below 70% of goal', () => {
    const days = [
      day('2026-03-10', 2000, 100, 50, 60),
      day('2026-03-11', 2000, 100, 50, 60),
      day('2026-03-12', 2000, 100, 50, 60),
    ]
    const macroGoals = { protein: null, carbs: 250, fat: null }
    const result = computeInsights(days, 2000, macroGoals)
    expect(result.macroWarnings).toContain('Low carbs this period')
  })

  it('warns about low fat when average is below 70% of goal', () => {
    const days = [
      day('2026-03-10', 2000, 100, 200, 10),
      day('2026-03-11', 2000, 100, 200, 10),
      day('2026-03-12', 2000, 100, 200, 10),
    ]
    const macroGoals = { protein: null, carbs: null, fat: 70 }
    const result = computeInsights(days, 2000, macroGoals)
    expect(result.macroWarnings).toContain('Low fat this period')
  })

  it('generates multiple macro warnings at once', () => {
    const days = [
      day('2026-03-10', 2000, 10, 10, 5),
      day('2026-03-11', 2000, 10, 10, 5),
      day('2026-03-12', 2000, 10, 10, 5),
    ]
    const macroGoals = { protein: 150, carbs: 250, fat: 70 }
    const result = computeInsights(days, 2000, macroGoals)
    expect(result.macroWarnings).toHaveLength(3)
  })

  it('does not warn for macros with null goals', () => {
    const days = [
      day('2026-03-10', 2000, 10, 10, 5),
      day('2026-03-11', 2000, 10, 10, 5),
      day('2026-03-12', 2000, 10, 10, 5),
    ]
    const result = computeInsights(days, 2000, noMacroGoals)
    expect(result.macroWarnings).toEqual([])
  })

  it('triggers macro warnings at exactly 3 logged days', () => {
    const days = [
      day('2026-03-10', 2000, 10, 10, 5),
      day('2026-03-11', 2000, 10, 10, 5),
      day('2026-03-12', 2000, 10, 10, 5),
    ]
    const macroGoals = { protein: 150, carbs: null, fat: null }
    const result = computeInsights(days, 2000, macroGoals)
    expect(result.macroWarnings).toContain('Low protein this period')
  })
})
