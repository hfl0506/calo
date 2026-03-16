/**
 * Convert a wall-clock datetime string (e.g. "2025-03-13T00:00:00") in the
 * given IANA timezone to an absolute UTC Date.
 *
 * Example: localDateToUTC("2025-03-13T00:00:00", "America/Los_Angeles")
 *   => 2025-03-13T08:00:00.000Z  (PST is UTC-8)
 */
export function localDateToUTC(localDatetime: string, timeZone: string): Date {
  // Build a Date object from the local datetime interpreted as UTC first
  const naive = new Date(localDatetime + 'Z')
  // Compute the offset: format the same instant in the target tz and find the diff
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    fractionalSecondDigits: 3,
  })
  // Format a reference point in the target tz to find the offset
  const refUtc = new Date(`${localDatetime}Z`)
  const parts = formatter.formatToParts(refUtc)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0'
  const tzTime = new Date(
    `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}.${get('fractionalSecond')}Z`,
  )
  // offset = how far ahead the tz is from UTC (in ms)
  const offsetMs = tzTime.getTime() - refUtc.getTime()
  // The actual UTC instant for the given wall-clock time in that tz
  return new Date(naive.getTime() - offsetMs)
}
