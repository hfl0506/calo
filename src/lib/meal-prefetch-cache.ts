import { getMealDetailFn } from '#/lib/server/meals'

const TTL = 30_000   // entries expire after 30s
const MAX_SIZE = 20  // never hold more than 20 meals in memory

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache = new Map<string, { data: any; fetchedAt: number }>()
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

// Proactively sweep expired entries every 60s
if (typeof window !== 'undefined') {
  setInterval(evictExpired, 60_000)
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
  getMealDetailFn({ data: { mealId } })
    .then((data) => {
      evictExpired()
      if (cache.size >= MAX_SIZE) evictOldest()
      cache.set(mealId, { data, fetchedAt: Date.now() })
    })
    .catch(() => { /* best-effort */ })
    .finally(() => inflight.delete(mealId))
}
