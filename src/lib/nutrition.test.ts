import { describe, expect, it } from 'vitest'
import { calcTotals, parseNutritionValue, roundMacro } from './nutrition'

const food = (calories: string, protein?: string, carbs?: string, fat?: string, fiber?: string) => ({
  calories,
  protein: protein ?? null,
  carbs: carbs ?? null,
  fat: fat ?? null,
  fiber: fiber ?? null,
})

describe('calcTotals', () => {
  it('returns zeros for empty foods list', () => {
    expect(calcTotals([])).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 })
  })

  it('sums calories correctly', () => {
    const foods = [food('250'), food('150'), food('100')]
    expect(calcTotals(foods).calories).toBe(500)
  })

  it('sums all macros correctly', () => {
    const foods = [food('300', '20', '30', '10', '5'), food('200', '15', '20', '5', '3')]
    expect(calcTotals(foods)).toEqual({ calories: 500, protein: 35, carbs: 50, fat: 15, fiber: 8 })
  })

  it('treats null macros as zero', () => {
    const foods = [food('100'), food('200')]
    const totals = calcTotals(foods)
    expect(totals.protein).toBe(0)
    expect(totals.carbs).toBe(0)
    expect(totals.fat).toBe(0)
    expect(totals.fiber).toBe(0)
  })

  it('handles decimal values', () => {
    const foods = [food('100.5', '10.25', '20.75', '5.5', '2.5')]
    expect(calcTotals(foods)).toEqual({ calories: 100.5, protein: 10.25, carbs: 20.75, fat: 5.5, fiber: 2.5 })
  })
})

describe('parseNutritionValue', () => {
  it('parses a valid numeric string', () => {
    expect(parseNutritionValue('42.5')).toBe(42.5)
  })

  it('returns 0 for null', () => {
    expect(parseNutritionValue(null)).toBe(0)
  })

  it('returns 0 for undefined', () => {
    expect(parseNutritionValue(undefined)).toBe(0)
  })

  it('returns 0 for non-numeric string', () => {
    expect(parseNutritionValue('abc')).toBe(0)
  })

  it('returns 0 for negative number', () => {
    expect(parseNutritionValue('-5')).toBe(0)
  })

  it('returns 0 for Infinity', () => {
    expect(parseNutritionValue('Infinity')).toBe(0)
  })

  it('returns 0 for empty string', () => {
    expect(parseNutritionValue('')).toBe(0)
  })

  it('parses zero correctly', () => {
    expect(parseNutritionValue('0')).toBe(0)
  })
})

describe('roundMacro', () => {
  it('rounds to 1 decimal place', () => {
    expect(roundMacro(10.25)).toBe(10.3)
  })

  it('rounds down correctly', () => {
    expect(roundMacro(10.24)).toBe(10.2)
  })

  it('leaves already-rounded values unchanged', () => {
    expect(roundMacro(5.0)).toBe(5)
  })

  it('handles zero', () => {
    expect(roundMacro(0)).toBe(0)
  })

  it('handles values at rounding boundary (0.05)', () => {
    expect(roundMacro(0.05)).toBe(0.1)
  })
})
