import { RateLimiterMemory } from 'rate-limiter-flexible'

// 10 AI analyses per user per minute
export const analyzeRateLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60,
})

// 30 recalculations per user per minute
export const recalculateRateLimiter = new RateLimiterMemory({
  points: 30,
  duration: 60,
})
