import { ResultAsync, errAsync, okAsync } from 'neverthrow'
import { GoogleGenerativeAI } from '@google/generative-ai'
import pRetry from 'p-retry'
import { z } from 'zod'
import { env } from '#/lib/env'
import type { GeminiError } from '#/lib/server/errors'

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY)
export const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

type GeminiContent = Parameters<typeof geminiModel.generateContent>[0]

function callGemini(content: GeminiContent): ResultAsync<string, GeminiError> {
  return ResultAsync.fromPromise(
    pRetry(() => geminiModel.generateContent(content), { retries: 2, minTimeout: 1000, factor: 2 }),
    (err): GeminiError => ({
      type: 'gemini_failed',
      message: err instanceof Error ? err.message : String(err),
    }),
  ).map((result) => result.response.text())
}

export function cleanGeminiJson(raw: string): string {
  return raw.replace(/```[a-z]*\n?/gi, '').trim()
}

function parseJson(text: string): ResultAsync<unknown, GeminiError> {
  try {
    const parsed: unknown = JSON.parse(cleanGeminiJson(text))
    return okAsync(parsed)
  } catch {
    return errAsync({ type: 'parse_error' } satisfies GeminiError)
  }
}

function validateSchema<T>(
  schema: z.ZodType<T>,
  raw: unknown,
): ResultAsync<T, GeminiError> {
  const result = schema.safeParse(raw)
  if (!result.success) return errAsync({ type: 'validation_error' } satisfies GeminiError)
  return okAsync(result.data)
}

export function generateAndParse<T>(
  content: GeminiContent,
  schema: z.ZodType<T>,
): ResultAsync<T, GeminiError> {
  return callGemini(content)
    .andThen(parseJson)
    .andThen((raw) => validateSchema(schema, raw))
}

export function generateAndParseWithNotFoodGuard<T>(
  content: GeminiContent,
  schema: z.ZodType<T>,
): ResultAsync<T, GeminiError> {
  return callGemini(content)
    .andThen(parseJson)
    .andThen((raw) => {
      if (
        raw !== null &&
        typeof raw === 'object' &&
        !Array.isArray(raw) &&
        'error' in raw &&
        raw.error === 'NOT_FOOD'
      ) {
        return errAsync({ type: 'not_food' } satisfies GeminiError)
      }
      return validateSchema(schema, raw)
    })
}
