export type GeminiError =
  | { type: 'gemini_failed'; message: string }
  | { type: 'parse_error' }
  | { type: 'validation_error' }
  | { type: 'not_food' }

/**
 * A user-facing error thrown by server functions.
 * The `message` is safe to display in the UI.
 * The `code` helps the client branch on error type without parsing strings.
 */
export class AppError extends Error {
  public readonly code: 'RATE_LIMITED' | 'NOT_FOOD' | 'NO_ITEMS' | 'ANALYSIS_FAILED' | 'NOT_FOUND' | 'UNAUTHORIZED' | 'FETCH_FAILED' | 'NO_BARCODE'
  public readonly retryAfterMs?: number

  constructor(
    code: AppError['code'],
    message: string,
    retryAfterMs?: number,
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.retryAfterMs = retryAfterMs
  }
}
