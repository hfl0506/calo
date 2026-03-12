import { describe, expect, it } from 'vitest'
import { calcTotals } from './nutrition'

const food = (calories: string, protein?: string, carbs?: string, fat?: string) => ({
  calories,
  protein: protein ?? null,
  carbs: carbs ?? null,
  fat: fat ?? null,
})

describe('calcTotals', () => {
  it('returns zeros for empty foods list', () => {
    expect(calcTotals([])).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  })

  it('sums calories correctly', () => {
    const foods = [food('250'), food('150'), food('100')]
    expect(calcTotals(foods).calories).toBe(500)
  })

  it('sums all macros correctly', () => {
    const foods = [food('300', '20', '30', '10'), food('200', '15', '20', '5')]
    expect(calcTotals(foods)).toEqual({ calories: 500, protein: 35, carbs: 50, fat: 15 })
  })

  it('treats null macros as zero', () => {
    const foods = [food('100'), food('200')]
    const totals = calcTotals(foods)
    expect(totals.protein).toBe(0)
    expect(totals.carbs).toBe(0)
    expect(totals.fat).toBe(0)
  })

  it('handles decimal values', () => {
    const foods = [food('100.5', '10.25', '20.75', '5.5')]
    expect(calcTotals(foods)).toEqual({ calories: 100.5, protein: 10.25, carbs: 20.75, fat: 5.5 })
  })
})
