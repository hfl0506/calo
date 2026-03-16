import { describe, expect, it } from 'vitest'
import { analyzeRateLimiter, recalculateRateLimiter } from './rate-limit'

describe('rate limiters', () => {
  it('analyzeRateLimiter is created with 10 points per 60 seconds', () => {
    expect(analyzeRateLimiter).toBeDefined()
    // Access internal config via the RateLimiterMemory API
    expect((analyzeRateLimiter as any)._points).toBe(10)
    expect((analyzeRateLimiter as any)._duration).toBe(60)
  })

  it('recalculateRateLimiter is created with 30 points per 60 seconds', () => {
    expect(recalculateRateLimiter).toBeDefined()
    expect((recalculateRateLimiter as any)._points).toBe(30)
    expect((recalculateRateLimiter as any)._duration).toBe(60)
  })

  it('analyzeRateLimiter.consume resolves on allowed request', async () => {
    // Use a unique key so this test doesn't interfere with others
    await expect(analyzeRateLimiter.consume('test-rate-limit-user-analyze')).resolves.toBeDefined()
  })

  it('recalculateRateLimiter.consume resolves on allowed request', async () => {
    await expect(recalculateRateLimiter.consume('test-rate-limit-user-recalc')).resolves.toBeDefined()
  })

  it('analyzeRateLimiter rejects after exhausting points', async () => {
    const userId = 'exhausted-user-analyze'
    // Consume all 10 points
    for (let i = 0; i < 10; i++) {
      await analyzeRateLimiter.consume(userId)
    }
    await expect(analyzeRateLimiter.consume(userId)).rejects.toBeDefined()
  })

  it('recalculateRateLimiter rejects after exhausting points', async () => {
    const userId = 'exhausted-user-recalc'
    // Consume all 30 points
    for (let i = 0; i < 30; i++) {
      await recalculateRateLimiter.consume(userId)
    }
    await expect(recalculateRateLimiter.consume(userId)).rejects.toBeDefined()
  })
})
