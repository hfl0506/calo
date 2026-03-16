import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnalyzedFood } from '#/lib/types'

// Mock localStorage before importing the module so module-level state is clean
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: () => { store = {} },
  }
})()

vi.stubGlobal('localStorage', localStorageMock)
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-1234' })

import {
  clearRecentFoods,
  getRecentFoods,
  recentFoodToAnalyzed,
  removeRecentFood,
  saveRecentFoods,
} from './recent-foods'

const makeFood = (name: string, calories = 100): AnalyzedFood => ({
  name,
  portionDescription: '1 serving',
  calories,
  protein: 10,
  carbs: 20,
  fat: 5,
  fiber: 2,
})

beforeEach(() => {
  localStorageMock.clear()
  localStorageMock.getItem.mockClear()
  localStorageMock.setItem.mockClear()
  localStorageMock.removeItem.mockClear()
  // Reset the module-level cache by clearing localStorage
  // getRecentFoods uses a cache tied to the raw string, clearing forces a re-read
})

describe('saveRecentFoods', () => {
  it('saves foods to localStorage', () => {
    saveRecentFoods([makeFood('Apple')])
    const saved = JSON.parse(localStorageMock.setItem.mock.calls[0][1])
    expect(saved).toHaveLength(1)
    expect(saved[0].name).toBe('Apple')
  })

  it('deduplicates by name case-insensitively, keeping the new entry', () => {
    saveRecentFoods([makeFood('apple', 80)])
    saveRecentFoods([makeFood('Apple', 90)])
    const raw = localStorageMock.setItem.mock.lastCall?.[1]
    const saved = JSON.parse(raw!)
    expect(saved).toHaveLength(1)
    expect(saved[0].calories).toBe(90)
  })

  it('skips foods with empty names', () => {
    saveRecentFoods([{ ...makeFood(''), name: '   ' }])
    const raw = localStorageMock.setItem.mock.lastCall?.[1]
    const saved = JSON.parse(raw!)
    expect(saved).toHaveLength(0)
  })

  it('sorts by most recently used', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1000)
    saveRecentFoods([makeFood('Banana'), makeFood('Apple')])
    vi.setSystemTime(2000)
    saveRecentFoods([makeFood('Cherry')])
    vi.useRealTimers()
    const raw = localStorageMock.setItem.mock.lastCall?.[1]
    const saved = JSON.parse(raw!)
    // Cherry was added most recently
    expect(saved[0].name).toBe('Cherry')
  })

  it('caps at 12 items', () => {
    const foods = Array.from({ length: 15 }, (_, i) => makeFood(`Food${i}`))
    saveRecentFoods(foods)
    const raw = localStorageMock.setItem.mock.lastCall?.[1]
    const saved = JSON.parse(raw!)
    expect(saved).toHaveLength(12)
  })
})

describe('removeRecentFood', () => {
  it('removes a food by name', () => {
    saveRecentFoods([makeFood('Apple'), makeFood('Banana')])
    removeRecentFood('Apple')
    const raw = localStorageMock.setItem.mock.lastCall?.[1]
    const saved = JSON.parse(raw!)
    expect(saved.map((f: { name: string }) => f.name)).not.toContain('Apple')
    expect(saved.map((f: { name: string }) => f.name)).toContain('Banana')
  })

  it('removes case-insensitively', () => {
    saveRecentFoods([makeFood('Apple')])
    removeRecentFood('apple')
    const raw = localStorageMock.setItem.mock.lastCall?.[1]
    const saved = JSON.parse(raw!)
    expect(saved).toHaveLength(0)
  })
})

describe('clearRecentFoods', () => {
  it('removes the storage key', () => {
    saveRecentFoods([makeFood('Apple')])
    clearRecentFoods()
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('recent_foods')
  })
})

describe('recentFoodToAnalyzed', () => {
  it('maps all fields correctly', () => {
    const recent = {
      name: 'Apple',
      portionDescription: '1 medium',
      calories: 95,
      protein: 0.5,
      carbs: 25,
      fat: 0.3,
      fiber: 4.4,
      lastUsed: Date.now(),
    }
    const analyzed = recentFoodToAnalyzed(recent)
    expect(analyzed).toMatchObject({
      name: 'Apple',
      portionDescription: '1 medium',
      calories: 95,
      protein: 0.5,
      carbs: 25,
      fat: 0.3,
      fiber: 4.4,
    })
  })

  it('assigns an id', () => {
    const recent = {
      name: 'Banana',
      portionDescription: '1 banana',
      calories: 105,
      protein: 1.3,
      carbs: 27,
      fat: 0.4,
      fiber: 3.1,
      lastUsed: Date.now(),
    }
    const analyzed = recentFoodToAnalyzed(recent)
    expect(analyzed.id).toBe('test-uuid-1234')
  })
})

describe('getRecentFoods', () => {
  it('returns empty array when localStorage is empty', () => {
    expect(getRecentFoods()).toEqual([])
  })

  it('returns parsed foods from localStorage', () => {
    const foods = [{ name: 'Apple', portionDescription: '1 serving', calories: 95, protein: 0.5, carbs: 25, fat: 0.3, fiber: 4.4, lastUsed: 1000 }]
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(foods))
    const result = getRecentFoods()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Apple')
  })

  it('returns cached result when raw string is unchanged', () => {
    const foods = [{ name: 'Apple', portionDescription: '1 serving', calories: 95, protein: 0.5, carbs: 25, fat: 0.3, fiber: 4.4, lastUsed: 1000 }]
    const raw = JSON.stringify(foods)
    localStorageMock.getItem.mockReturnValue(raw)
    const first = getRecentFoods()
    const second = getRecentFoods()
    expect(first).toBe(second) // same reference = cache hit
  })

  it('returns fallback cached array when localStorage throws', () => {
    localStorageMock.getItem.mockImplementation(() => { throw new Error('SecurityError') })
    // Should not throw, returns cached (empty) array
    expect(() => getRecentFoods()).not.toThrow()
  })
})

describe('saveRecentFoods - error handling', () => {
  it('does not throw when localStorage.setItem throws', () => {
    localStorageMock.setItem.mockImplementationOnce(() => { throw new Error('QuotaExceededError') })
    expect(() => saveRecentFoods([makeFood('Apple')])).not.toThrow()
  })
})

describe('removeRecentFood - error handling', () => {
  it('does not throw when localStorage.setItem throws', () => {
    localStorageMock.setItem.mockImplementationOnce(() => { throw new Error('SecurityError') })
    expect(() => removeRecentFood('Apple')).not.toThrow()
  })
})

describe('clearRecentFoods - error handling', () => {
  it('does not throw when localStorage.removeItem throws', () => {
    localStorageMock.removeItem.mockImplementationOnce(() => { throw new Error('SecurityError') })
    expect(() => clearRecentFoods()).not.toThrow()
  })
})
