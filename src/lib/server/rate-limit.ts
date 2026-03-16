import { RateLimiterMemory } from 'rate-limiter-flexible'

// NOTE: RateLimiterMemory is per-process. In a multi-process or serverless
// deployment these counters are not shared across instances. Replace with
// RateLimiterRedis (rate-limiter-flexible) for distributed enforcement.

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
