import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── vi.hoisted: define mock fns before any imports ────────────────────────
const {
  mockGetSession,
  mockGetRequest,
  mockGenerateContent,
  mockAnalyzeConsume,
  mockRecalcConsume,
  mockR2Send,
  mockDbFindMany,
  mockDbFindFirst,
  mockDbTransaction,
  mockDbInsert,
  mockDbUpdate,
  mockDbDelete,
  mockDbSelect,
  mockDbSelectDistinct,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockGetRequest: vi.fn(() => ({ headers: { get: vi.fn().mockReturnValue(null) } })),
  mockGenerateContent: vi.fn(),
  mockAnalyzeConsume: vi.fn(),
  mockRecalcConsume: vi.fn(),
  mockR2Send: vi.fn(),
  mockDbFindMany: vi.fn(),
  mockDbFindFirst: vi.fn(),
  mockDbTransaction: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbDelete: vi.fn(),
  mockDbSelect: vi.fn(),
  mockDbSelectDistinct: vi.fn(),
}))

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    const chain: any = {
      inputValidator: () => chain,
      handler: (fn: any) => (args?: any) => fn(args ?? {}),
    }
    return chain
  },
}))

vi.mock('@tanstack/react-start/server', () => ({ getRequest: mockGetRequest }))

vi.mock('#/lib/server/session', () => ({ getSession: mockGetSession }))

vi.mock('#/lib/server/rate-limit', () => ({
  analyzeRateLimiter: { consume: mockAnalyzeConsume },
  recalculateRateLimiter: { consume: mockRecalcConsume },
}))

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(() => ({
    getGenerativeModel: vi.fn(() => ({ generateContent: mockGenerateContent })),
  })),
}))

vi.mock('p-retry', () => ({ default: (fn: any) => fn(0) }))

vi.mock('@aws-sdk/client-s3', () => ({ DeleteObjectCommand: vi.fn() }))

vi.mock('#/lib/server/r2', () => ({ getR2Client: vi.fn(() => ({ send: mockR2Send })) }))

vi.mock('#/db', () => ({
  db: {
    query: {
      meals: { findMany: mockDbFindMany, findFirst: mockDbFindFirst },
      userSettings: { findFirst: vi.fn() },
    },
    transaction: mockDbTransaction,
    insert: mockDbInsert,
    update: mockDbUpdate,
    delete: mockDbDelete,
    select: mockDbSelect,
    selectDistinct: mockDbSelectDistinct,
  },
}))

// ── Import server functions AFTER all vi.mock calls ───────────────────────
import {
  analyzeImageFn,
  analyzePromptFn,
  deleteMealFn,
  getMealDetailFn,
  getMealsByDateFn,
  getMealsRangeFn,
  getStreakFn,
  recalculateNutritionFn,
  saveMealFn,
  updateMealFn,
} from './meals'

// ── Helpers ────────────────────────────────────────────────────────────────
const SESSION = { user: { id: 'user-1', email: 'test@example.com', name: 'Test' } }

const MEAL_ROW = {
  id: 'meal-uuid-1',
  userId: 'user-1',
  tag: 'lunch' as const,
  loggedAt: new Date('2026-03-16T12:00:00Z'),
  imageUrl: null,
  notes: null,
  createdAt: new Date('2026-03-16T12:00:00Z'),
  mealFoods: [
    {
      id: 1,
      mealId: 'meal-uuid-1',
      name: 'Rice',
      portionDescription: '1 cup',
      calories: '300',
      protein: '6',
      carbs: '65',
      fat: '1',
      fiber: '2',
      createdAt: new Date(),
    },
  ],
}

const FOOD_INPUT = {
  name: 'Rice',
  portionDescription: '1 cup',
  calories: 300,
  protein: 6,
  carbs: 65,
  fat: 1,
  fiber: 2,
}

/** Build a mock tx for saveMealFn (two inserts: meals then mealFoods) */
function makeSaveTx(mealId = 'meal-uuid-1') {
  return {
    insert: vi.fn()
      .mockImplementationOnce(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: mealId }]),
        })),
      }))
      .mockImplementation(() => ({
        values: vi.fn().mockResolvedValue(undefined),
      })),
  }
}

/** Build a mock tx for updateMealFn */
function makeUpdateTx(found = true, mealId = 'meal-uuid-1') {
  return {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue(found ? [{ id: mealId }] : []),
        })),
      })),
    })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: authenticated
  mockGetSession.mockResolvedValue(SESSION)
  // Default: rate limiters allow
  mockAnalyzeConsume.mockResolvedValue(undefined)
  mockRecalcConsume.mockResolvedValue(undefined)
})

// ── saveMealFn ─────────────────────────────────────────────────────────────
describe('saveMealFn', () => {
  it('throws Unauthorized when session is null', async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(saveMealFn({ data: { tag: 'lunch', foods: [FOOD_INPUT] } })).rejects.toThrow('Unauthorized')
  })

  it('returns mealId on success', async () => {
    const tx = makeSaveTx('new-meal-id')
    mockDbTransaction.mockImplementation((fn: any) => fn(tx))
    const result = await saveMealFn({ data: { tag: 'lunch', foods: [FOOD_INPUT] } })
    expect(result).toEqual({ mealId: 'new-meal-id' })
  })

  it('saves optional imageUrl and notes', async () => {
    const tx = makeSaveTx()
    mockDbTransaction.mockImplementation((fn: any) => fn(tx))
    await saveMealFn({
      data: {
        tag: 'dinner',
        foods: [FOOD_INPUT],
        imageUrl: 'https://r2.example.com/meals/img.jpg',
        notes: 'post-workout',
        loggedAt: '2026-03-16T12:00:00Z',
      },
    })
    expect(tx.insert).toHaveBeenCalledTimes(2)
  })

  it('throws when meal insert returns empty (db failure)', async () => {
    const tx = {
      insert: vi.fn().mockImplementationOnce(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([]),
        })),
      })),
    }
    mockDbTransaction.mockImplementation((fn: any) => fn(tx))
    await expect(saveMealFn({ data: { tag: 'lunch', foods: [FOOD_INPUT] } })).rejects.toThrow('Failed to create meal')
  })
})

// ── getMealsByDateFn ───────────────────────────────────────────────────────
describe('getMealsByDateFn', () => {
  it('throws Unauthorized when no session', async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(getMealsByDateFn({ data: {} })).rejects.toThrow('Unauthorized')
  })

  it('returns meals with computed totals', async () => {
    mockDbFindMany.mockResolvedValue([MEAL_ROW])
    const result = await getMealsByDateFn({ data: { date: '2026-03-16', timezone: 'UTC' } })
    expect(result).toHaveLength(1)
    expect(result[0].totals).toMatchObject({ calories: 300 })
  })

  it('returns empty array when no meals', async () => {
    mockDbFindMany.mockResolvedValue([])
    const result = await getMealsByDateFn({ data: { date: '2026-03-16', timezone: 'UTC' } })
    expect(result).toHaveLength(0)
  })

  it('reads timezone from tz cookie when not provided in data', async () => {
    mockDbFindMany.mockResolvedValue([])
    const mockReq = { headers: { get: vi.fn().mockReturnValue('tz=America%2FNew_York') } }
    mockGetRequest.mockReturnValue(mockReq)
    const result = await getMealsByDateFn({ data: {} })
    expect(result).toHaveLength(0)
  })

  it('falls back to Intl timezone when no cookie and no request context', async () => {
    mockDbFindMany.mockResolvedValue([])
    mockGetRequest.mockImplementation(() => { throw new Error('no context') })
    const result = await getMealsByDateFn({ data: { date: '2026-03-16' } })
    expect(result).toHaveLength(0)
  })
})

// ── getMealsRangeFn ────────────────────────────────────────────────────────
describe('getMealsRangeFn', () => {
  it('throws Unauthorized when no session', async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(getMealsRangeFn({ data: { startDate: '2026-03-01', endDate: '2026-03-07' } })).rejects.toThrow('Unauthorized')
  })

  it('returns meals for date range with totals', async () => {
    mockDbFindMany.mockResolvedValue([MEAL_ROW])
    const result = await getMealsRangeFn({ data: { startDate: '2026-03-01', endDate: '2026-03-07', timezone: 'UTC' } })
    expect(result).toHaveLength(1)
    expect(result[0].totals.calories).toBe(300)
  })
})

// ── getMealDetailFn ────────────────────────────────────────────────────────
describe('getMealDetailFn', () => {
  it('throws Unauthorized when no session', async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(getMealDetailFn({ data: { mealId: 'meal-uuid-1' } })).rejects.toThrow('Unauthorized')
  })

  it('returns meal with totals when found', async () => {
    mockDbFindFirst.mockResolvedValue(MEAL_ROW)
    const result = await getMealDetailFn({ data: { mealId: 'meal-uuid-1' } })
    expect(result.id).toBe('meal-uuid-1')
    expect(result.totals.calories).toBe(300)
  })

  it('throws when meal not found', async () => {
    mockDbFindFirst.mockResolvedValue(undefined)
    await expect(getMealDetailFn({ data: { mealId: 'meal-uuid-1' } })).rejects.toThrow('Meal not found')
  })
})

// ── updateMealFn ───────────────────────────────────────────────────────────
describe('updateMealFn', () => {
  it('throws Unauthorized when no session', async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(
      updateMealFn({ data: { mealId: 'meal-uuid-1', foods: [FOOD_INPUT] } }),
    ).rejects.toThrow('Unauthorized')
  })

  it('returns success on update', async () => {
    const tx = makeUpdateTx(true)
    mockDbTransaction.mockImplementation((fn: any) => fn(tx))
    const result = await updateMealFn({ data: { mealId: 'meal-uuid-1', foods: [FOOD_INPUT], notes: 'updated' } })
    expect(result).toEqual({ success: true })
  })

  it('throws when meal not found or wrong owner', async () => {
    const tx = makeUpdateTx(false)
    mockDbTransaction.mockImplementation((fn: any) => fn(tx))
    await expect(
      updateMealFn({ data: { mealId: 'meal-uuid-1', foods: [FOOD_INPUT] } }),
    ).rejects.toThrow('Meal not found')
  })
})

// ── deleteMealFn ───────────────────────────────────────────────────────────
describe('deleteMealFn', () => {
  it('throws Unauthorized when no session', async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(deleteMealFn({ data: { mealId: 'meal-uuid-1' } })).rejects.toThrow('Unauthorized')
  })

  it('returns success when meal has no image', async () => {
    const mockWhere = vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ imageUrl: null }]) }))
    mockDbDelete.mockReturnValue({ where: mockWhere })
    const result = await deleteMealFn({ data: { mealId: 'meal-uuid-1' } })
    expect(result).toEqual({ success: true })
    expect(mockR2Send).not.toHaveBeenCalled()
  })

  it('deletes R2 object when meal has imageUrl', async () => {
    process.env.R2_PUBLIC_URL = 'https://pub.r2.dev'
    process.env.R2_BUCKET_NAME = 'my-bucket'
    const mockWhere = vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([{ imageUrl: 'https://pub.r2.dev/meals/user-1/img.jpg' }]),
    }))
    mockDbDelete.mockReturnValue({ where: mockWhere })
    mockR2Send.mockResolvedValue(undefined)
    const result = await deleteMealFn({ data: { mealId: 'meal-uuid-1' } })
    expect(result).toEqual({ success: true })
    expect(mockR2Send).toHaveBeenCalledOnce()
  })

  it('still returns success if R2 deletion fails', async () => {
    process.env.R2_PUBLIC_URL = 'https://pub.r2.dev'
    const mockWhere = vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([{ imageUrl: 'https://pub.r2.dev/meals/img.jpg' }]),
    }))
    mockDbDelete.mockReturnValue({ where: mockWhere })
    mockR2Send.mockRejectedValue(new Error('R2 error'))
    const result = await deleteMealFn({ data: { mealId: 'meal-uuid-1' } })
    expect(result).toEqual({ success: true })
  })

  it('throws when meal not found', async () => {
    const mockWhere = vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) }))
    mockDbDelete.mockReturnValue({ where: mockWhere })
    await expect(deleteMealFn({ data: { mealId: 'meal-uuid-1' } })).rejects.toThrow('Meal not found')
  })
})

// ── getStreakFn ────────────────────────────────────────────────────────────
describe('getStreakFn', () => {
  it('throws Unauthorized when no session', async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(getStreakFn({})).rejects.toThrow('Unauthorized')
  })

  it('returns 0 when no meals logged', async () => {
    mockDbSelectDistinct.mockReturnValue({
      from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
    })
    const result = await getStreakFn({})
    expect(result.streak).toBe(0)
  })

  it('counts consecutive days ending today', async () => {
    vi.setSystemTime(new Date('2026-03-16T12:00:00Z'))
    const rows = [
      { date: '2026-03-16' },
      { date: '2026-03-15' },
      { date: '2026-03-14' },
    ]
    mockDbSelectDistinct.mockReturnValue({
      from: vi.fn(() => ({ where: vi.fn().mockResolvedValue(rows) })),
    })
    const result = await getStreakFn({})
    expect(result.streak).toBe(3)
    vi.useRealTimers()
  })

  it('counts streak from yesterday when today has no meals', async () => {
    vi.setSystemTime(new Date('2026-03-16T12:00:00Z'))
    const rows = [
      { date: '2026-03-15' },
      { date: '2026-03-14' },
    ]
    mockDbSelectDistinct.mockReturnValue({
      from: vi.fn(() => ({ where: vi.fn().mockResolvedValue(rows) })),
    })
    const result = await getStreakFn({})
    expect(result.streak).toBe(2)
    vi.useRealTimers()
  })

  it('breaks streak on non-consecutive days', async () => {
    vi.setSystemTime(new Date('2026-03-16T12:00:00Z'))
    const rows = [
      { date: '2026-03-16' },
      // gap on Mar 15
      { date: '2026-03-14' },
    ]
    mockDbSelectDistinct.mockReturnValue({
      from: vi.fn(() => ({ where: vi.fn().mockResolvedValue(rows) })),
    })
    const result = await getStreakFn({})
    expect(result.streak).toBe(1)
    vi.useRealTimers()
  })

  it('reads tz cookie from request headers', async () => {
    const mockReq = { headers: { get: vi.fn().mockReturnValue('tz=Asia%2FHong_Kong') } }
    mockGetRequest.mockReturnValue(mockReq)
    mockDbSelectDistinct.mockReturnValue({
      from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
    })
    const result = await getStreakFn({})
    expect(result.streak).toBe(0)
  })
})

// ── analyzePromptFn ────────────────────────────────────────────────────────
describe('analyzePromptFn', () => {
  it('throws Unauthorized when no session', async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(analyzePromptFn({ data: { prompt: 'rice and chicken' } })).rejects.toThrow('Unauthorized')
  })

  it('returns foods on valid food prompt', async () => {
    const foods = [{ name: 'Rice', portionDescription: '1 cup', calories: 300, protein: 6, carbs: 65, fat: 1, fiber: 2 }]
    mockGenerateContent.mockResolvedValue({ response: { text: () => JSON.stringify(foods) } })
    const result = await analyzePromptFn({ data: { prompt: 'a bowl of rice' } })
    expect(result.foods).toHaveLength(1)
    expect(result.foods[0].name).toBe('Rice')
  })

  it('throws NOT_FOOD error for non-food prompt', async () => {
    mockGenerateContent.mockResolvedValue({ response: { text: () => JSON.stringify({ error: 'NOT_FOOD' }) } })
    await expect(analyzePromptFn({ data: { prompt: 'what is the capital of France?' } })).rejects.toThrow('food')
  })

  it('throws when JSON parse fails', async () => {
    mockGenerateContent.mockResolvedValue({ response: { text: () => 'invalid json {{{' } })
    await expect(analyzePromptFn({ data: { prompt: 'rice' } })).rejects.toThrow()
  })

  it('throws when no food items detected in valid JSON', async () => {
    mockGenerateContent.mockResolvedValue({ response: { text: () => '[]' } })
    await expect(analyzePromptFn({ data: { prompt: 'rice' } })).rejects.toThrow('No food items')
  })

  it('throws when Gemini throws', async () => {
    mockGenerateContent.mockRejectedValue(new Error('API error'))
    await expect(analyzePromptFn({ data: { prompt: 'rice' } })).rejects.toThrow()
  })

  it('throws rate limit error when rate limiter rejects', async () => {
    mockAnalyzeConsume.mockRejectedValue({ msBeforeNext: 5000 })
    await expect(analyzePromptFn({ data: { prompt: 'rice' } })).rejects.toThrow('5 second')
  })

  it('strips markdown code fences from Gemini response', async () => {
    const foods = [{ name: 'Apple', portionDescription: '1 medium', calories: 95, protein: 0.5, carbs: 25, fat: 0.3, fiber: 4.4 }]
    mockGenerateContent.mockResolvedValue({
      response: { text: () => '```json\n' + JSON.stringify(foods) + '\n```' },
    })
    const result = await analyzePromptFn({ data: { prompt: 'an apple' } })
    expect(result.foods).toHaveLength(1)
  })
})

// ── analyzeImageFn ─────────────────────────────────────────────────────────
describe('analyzeImageFn', () => {
  const IMAGE_DATA = { imageBase64: 'base64data', mimeType: 'image/jpeg' as const }

  it('throws Unauthorized when no session', async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(analyzeImageFn({ data: IMAGE_DATA })).rejects.toThrow('Unauthorized')
  })

  it('returns foods from image', async () => {
    const foods = [{ name: 'Burger', portionDescription: '1 burger', calories: 500, protein: 25, carbs: 40, fat: 20, fiber: 2 }]
    mockGenerateContent.mockResolvedValue({ response: { text: () => JSON.stringify(foods) } })
    const result = await analyzeImageFn({ data: IMAGE_DATA })
    expect(result.foods).toHaveLength(1)
    expect(result.foods[0].name).toBe('Burger')
  })

  it('throws when no food detected (empty array)', async () => {
    mockGenerateContent.mockResolvedValue({ response: { text: () => '[]' } })
    await expect(analyzeImageFn({ data: IMAGE_DATA })).rejects.toThrow('No food items')
  })

  it('throws when JSON parse fails', async () => {
    mockGenerateContent.mockResolvedValue({ response: { text: () => 'not json' } })
    await expect(analyzeImageFn({ data: IMAGE_DATA })).rejects.toThrow()
  })

  it('throws on Gemini failure', async () => {
    mockGenerateContent.mockRejectedValue(new Error('Image too large'))
    await expect(analyzeImageFn({ data: IMAGE_DATA })).rejects.toThrow()
  })

  it('throws rate limit error when rate limiter rejects', async () => {
    mockAnalyzeConsume.mockRejectedValue({ msBeforeNext: 30000 })
    await expect(analyzeImageFn({ data: IMAGE_DATA })).rejects.toThrow('30 second')
  })
})

// ── recalculateNutritionFn ────────────────────────────────────────────────
describe('recalculateNutritionFn', () => {
  const RECALC_DATA = {
    originalName: 'Rice',
    adjustmentPrompt: 'half of it',
    portionDescription: '1 cup',
  }

  it('throws Unauthorized when no session', async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(recalculateNutritionFn({ data: RECALC_DATA })).rejects.toThrow('Unauthorized')
  })

  it('returns adjusted food on success', async () => {
    const adjusted = { name: 'Rice (half)', portionDescription: '0.5 cup', calories: 150, protein: 3, carbs: 32, fat: 0.5, fiber: 1 }
    mockGenerateContent.mockResolvedValue({ response: { text: () => JSON.stringify(adjusted) } })
    const result = await recalculateNutritionFn({ data: RECALC_DATA })
    expect(result.food?.name).toBe('Rice (half)')
  })

  it('throws when Gemini returns invalid nutrition schema', async () => {
    const invalid = { name: 'Rice', calories: 'not a number' }
    mockGenerateContent.mockResolvedValue({ response: { text: () => JSON.stringify(invalid) } })
    await expect(recalculateNutritionFn({ data: RECALC_DATA })).rejects.toThrow('Failed to recalculate')
  })

  it('throws when Gemini throws', async () => {
    mockGenerateContent.mockRejectedValue(new Error('timeout'))
    await expect(recalculateNutritionFn({ data: RECALC_DATA })).rejects.toThrow('Failed to recalculate')
  })

  it('throws rate limit error when rate limiter rejects', async () => {
    mockRecalcConsume.mockRejectedValue({ msBeforeNext: 2000 })
    await expect(recalculateNutritionFn({ data: RECALC_DATA })).rejects.toThrow('2 second')
  })

  it('uses "standard serving" when portionDescription is not provided', async () => {
    const adjusted = { name: 'Rice', portionDescription: 'standard', calories: 300, protein: 6, carbs: 65, fat: 1, fiber: 2 }
    mockGenerateContent.mockResolvedValue({ response: { text: () => JSON.stringify(adjusted) } })
    const result = await recalculateNutritionFn({ data: { originalName: 'Rice', adjustmentPrompt: 'double it' } })
    expect(result.food).toBeDefined()
  })
})
