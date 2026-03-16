import { getMealDetailFn } from '#/lib/server/meals'

const TTL = 30_000   // entries expire after 30s
const MAX_SIZE = 20  // never hold more than 20 meals in memory

type CacheEntry = { data: Awaited<ReturnType<typeof getMealDetailFn>>; fetchedAt: number }

const cache = new Map<string, CacheEntry>()
const inflight = new Set<string>() // deduplicates concurrent prefetch calls

function evictExpired(): void {
  const now = Date.now()
  for (const [id, entry] of cache) {
    if (now - entry.fetchedAt > TTL) cache.delete(id)
  }
}

function evictOldest(): void {
  // Map iterates in insertion order — first entry is oldest
  const firstKey = cache.keys().next().value
  if (firstKey) cache.delete(firstKey)
}

// Proactively sweep expired entries every 60s — store ID so it can be cancelled
let evictIntervalId: ReturnType<typeof setInterval> | undefined
if (typeof window !== 'undefined') {
  evictIntervalId = setInterval(evictExpired, 60_000)
}

// Call this on sign-out to prevent data leaking to the next user
export function clearPrefetchCache(): void {
  cache.clear()
  inflight.clear()
  if (evictIntervalId !== undefined) {
    clearInterval(evictIntervalId)
    evictIntervalId = undefined
  }
}

export function getCachedMealDetail(mealId: string) {
  const entry = cache.get(mealId)
  if (!entry) return null
  if (Date.now() - entry.fetchedAt > TTL) {
    cache.delete(mealId)
    return null
  }
  return entry.data
}

export function prefetchMealDetail(mealId: string): void {
  if (getCachedMealDetail(mealId)) return
  if (inflight.has(mealId)) return

  inflight.add(mealId)
  void getMealDetailFn({ data: { mealId } })
    .then((data) => {
      evictExpired()
      if (cache.size >= MAX_SIZE) evictOldest()
      cache.set(mealId, { data, fetchedAt: Date.now() })
    })
    .catch((err) => { console.warn('[prefetch] failed for', mealId, err) })
    .finally(() => inflight.delete(mealId))
}
