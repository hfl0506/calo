import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetSession, mockDbFindFirst, mockDbInsert } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockDbFindFirst: vi.fn(),
  mockDbInsert: vi.fn(),
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

vi.mock('#/lib/server/session.server', () => ({ getSession: mockGetSession }))

vi.mock('#/db', () => ({
  db: {
    query: { userSettings: { findFirst: mockDbFindFirst } },
    insert: mockDbInsert,
  },
}))

import { getUserSettingsFn, updateUserSettingsFn } from './settings'

const SESSION = { user: { id: 'user-1', email: 'test@example.com', name: 'Test' } }

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSession.mockResolvedValue(SESSION)
})

describe('getUserSettingsFn', () => {
  it('throws Unauthorized when no session', async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(getUserSettingsFn({})).rejects.toThrow('Unauthorized')
  })

  it('returns default calorie goal when no settings row exists', async () => {
    mockDbFindFirst.mockResolvedValue(undefined)
    const result = await getUserSettingsFn({})
    expect(result.dailyCalorieGoal).toBe(2000)
    expect(result.proteinGoal).toBeNull()
    expect(result.carbsGoal).toBeNull()
    expect(result.fatGoal).toBeNull()
    expect(result.fiberGoal).toBeNull()
  })

  it('returns stored settings when row exists', async () => {
    mockDbFindFirst.mockResolvedValue({
      dailyCalorieGoal: 2500,
      proteinGoal: 180,
      carbsGoal: 300,
      fatGoal: 80,
      fiberGoal: 30,
    })
    const result = await getUserSettingsFn({})
    expect(result.dailyCalorieGoal).toBe(2500)
    expect(result.proteinGoal).toBe(180)
    expect(result.carbsGoal).toBe(300)
    expect(result.fatGoal).toBe(80)
    expect(result.fiberGoal).toBe(30)
  })

  it('returns null for missing optional macro goals', async () => {
    mockDbFindFirst.mockResolvedValue({
      dailyCalorieGoal: 1800,
      proteinGoal: null,
      carbsGoal: null,
      fatGoal: null,
      fiberGoal: null,
    })
    const result = await getUserSettingsFn({})
    expect(result.proteinGoal).toBeNull()
  })
})

describe('updateUserSettingsFn', () => {
  it('throws Unauthorized when no session', async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(
      updateUserSettingsFn({ data: { dailyCalorieGoal: 2000 } }),
    ).rejects.toThrow('Unauthorized')
  })

  it('returns success after upsert', async () => {
    const mockOnConflict = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflict }))
    mockDbInsert.mockReturnValue({ values: mockValues })

    const result = await updateUserSettingsFn({ data: { dailyCalorieGoal: 2500 } })
    expect(result).toEqual({ success: true })
    expect(mockOnConflict).toHaveBeenCalledOnce()
  })

  it('saves macro goals when provided', async () => {
    const mockOnConflict = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflict }))
    mockDbInsert.mockReturnValue({ values: mockValues })

    await updateUserSettingsFn({
      data: { dailyCalorieGoal: 2000, proteinGoal: 150, carbsGoal: 250, fatGoal: 70, fiberGoal: 30 },
    })
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ proteinGoal: 150, carbsGoal: 250, fatGoal: 70, fiberGoal: 30 }),
    )
  })

  it('stores null for omitted optional goals', async () => {
    const mockOnConflict = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflict }))
    mockDbInsert.mockReturnValue({ values: mockValues })

    await updateUserSettingsFn({ data: { dailyCalorieGoal: 2000 } })
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ proteinGoal: null, carbsGoal: null, fatGoal: null, fiberGoal: null }),
    )
  })
})
