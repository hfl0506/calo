export type GeminiError =
  | { type: 'gemini_failed'; message: string }
  | { type: 'parse_error' }
  | { type: 'validation_error' }
  | { type: 'not_food' }
  | { type: 'no_items_detected' }
