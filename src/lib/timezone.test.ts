import { describe, expect, it } from 'vitest'
import { localDateToUTC } from './timezone'

describe('localDateToUTC', () => {
  it('converts PST (UTC-8) midnight to correct UTC time', () => {
    // March 2025, before DST (PST = UTC-8)
    const result = localDateToUTC('2025-02-15T00:00:00', 'America/Los_Angeles')
    expect(result.toISOString()).toBe('2025-02-15T08:00:00.000Z')
  })

  it('converts PDT (UTC-7, after DST change) midnight to correct UTC time', () => {
    // After March 9 2025, LA switches to PDT = UTC-7
    const result = localDateToUTC('2025-06-15T00:00:00', 'America/Los_Angeles')
    expect(result.toISOString()).toBe('2025-06-15T07:00:00.000Z')
  })

  it('converts UTC timezone — no offset applied', () => {
    const result = localDateToUTC('2025-03-13T12:00:00', 'UTC')
    expect(result.toISOString()).toBe('2025-03-13T12:00:00.000Z')
  })

  it('converts IST (UTC+5:30) to correct UTC time', () => {
    const result = localDateToUTC('2025-03-13T00:00:00', 'Asia/Kolkata')
    expect(result.toISOString()).toBe('2025-03-12T18:30:00.000Z')
  })

  it('converts HKT (UTC+8) to correct UTC time', () => {
    const result = localDateToUTC('2025-03-13T00:00:00', 'Asia/Hong_Kong')
    expect(result.toISOString()).toBe('2025-03-12T16:00:00.000Z')
  })

  it('handles end-of-day boundary (23:59:59) for date range queries', () => {
    // EST is UTC-5 in March (before DST)
    const result = localDateToUTC('2025-03-08T23:59:59', 'America/New_York')
    expect(result.toISOString()).toBe('2025-03-09T04:59:59.000Z')
  })

  it('handles DST spring-forward transition without throwing', () => {
    // 2025-03-09T02:30:00 in LA technically does not exist (clocks skip 2:00–3:00)
    expect(() => localDateToUTC('2025-03-09T02:30:00', 'America/Los_Angeles')).not.toThrow()
  })

  it('converts noon correctly to verify non-midnight times work', () => {
    const result = localDateToUTC('2025-06-01T12:00:00', 'America/New_York')
    // EDT = UTC-4
    expect(result.toISOString()).toBe('2025-06-01T16:00:00.000Z')
  })
})
