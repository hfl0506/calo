import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatDate, formatDateTime, formatTime } from './format'

describe('formatDate', () => {
  beforeEach(() => {
    // Fix "today" to 2026-03-16 UTC
    vi.setSystemTime(new Date('2026-03-16T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "Today" for today\'s date', () => {
    // Use en-CA locale to get YYYY-MM-DD — matches what the function computes for todayStr
    const today = new Date().toLocaleDateString('en-CA')
    expect(formatDate(today)).toBe('Today')
  })

  it('returns "Yesterday" for yesterday\'s date', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toLocaleDateString('en-CA')
    expect(formatDate(yesterdayStr)).toBe('Yesterday')
  })

  it('returns a formatted date string for older dates', () => {
    const result = formatDate('2026-03-01')
    // Should not be "Today" or "Yesterday"
    expect(result).not.toBe('Today')
    expect(result).not.toBe('Yesterday')
    // Should contain a month abbreviation and day number
    expect(result).toMatch(/Mar/)
    expect(result).toMatch(/1/)
  })
})

describe('formatTime', () => {
  it('returns empty string for null', () => {
    expect(formatTime(null)).toBe('')
  })

  it('returns a formatted time string for a valid date', () => {
    const date = new Date('2026-03-16T14:30:00')
    const result = formatTime(date)
    // Should contain hour and minute separated by colon
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })
})

describe('formatDateTime', () => {
  it('returns empty string for null', () => {
    expect(formatDateTime(null)).toBe('')
  })

  it('returns a formatted datetime string for a valid date', () => {
    const date = new Date('2026-03-16T14:30:00')
    const result = formatDateTime(date)
    // Should contain a colon (time part) and a comma or space (date part)
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })
})
