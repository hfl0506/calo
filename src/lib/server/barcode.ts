import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { generateAndParse } from '#/lib/server/gemini'
import { getSession } from '#/lib/server/session.server'
import { analyzeRateLimiter } from '#/lib/server/rate-limit'
import { AppError } from '#/lib/server/errors'
import type { AnalyzedFood } from '#/lib/types'

interface OpenFoodFactsProduct {
  product_name?: string
  nutriments?: {
    'energy-kcal_100g'?: number
    proteins_100g?: number
    carbohydrates_100g?: number
    fat_100g?: number
    fiber_100g?: number
  }
  serving_size?: string
}

const barcodeResultSchema = z.object({
  barcode: z.string().regex(/^\d{8,14}$/),
})

const BARCODE_PROMPT = `You are a barcode reader. Look at this image and extract the barcode number.

Rules:
- Only extract barcodes (EAN-8, EAN-13, UPC-A, UPC-E, or other standard product barcodes)
- Return ONLY the numeric barcode value
- If you cannot find a barcode in the image, return {"error": "NO_BARCODE"}
- If the image contains food or anything other than a barcode, return {"error": "NO_BARCODE"}

Respond in JSON: {"barcode": "1234567890123"}`

const scanBarcodeSchema = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
})

async function lookupOpenFoodFacts(barcode: string): Promise<AnalyzedFood> {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,nutriments,serving_size`,
    {
      headers: { 'User-Agent': 'Calo/1.0 (calorie-tracker)' },
      signal: AbortSignal.timeout(8000),
    },
  )

  if (!res.ok) {
    throw new AppError('FETCH_FAILED', 'Failed to fetch product info')
  }

  const json = (await res.json()) as { status: number; product?: OpenFoodFactsProduct }

  if (json.status !== 1 || !json.product) {
    throw new AppError('NOT_FOUND', 'Product not found in database. Try photo or text input instead.')
  }

  const p = json.product
  const n = p.nutriments ?? {}

  return {
    name: p.product_name || 'Unknown product',
    portionDescription: `1 serving (${p.serving_size || '100g'})`,
    calories: Math.round(n['energy-kcal_100g'] ?? 0),
    protein: Math.round((n.proteins_100g ?? 0) * 10) / 10,
    carbs: Math.round((n.carbohydrates_100g ?? 0) * 10) / 10,
    fat: Math.round((n.fat_100g ?? 0) * 10) / 10,
    fiber: Math.round((n.fiber_100g ?? 0) * 10) / 10,
  }
}

export const scanBarcodeFn = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => scanBarcodeSchema.parse(d))
  .handler(async ({ data }): Promise<{ food: AnalyzedFood }> => {
    const session = await getSession()
    if (!session) throw new AppError('UNAUTHORIZED', 'Unauthorized')

    try {
      await analyzeRateLimiter.consume(session.user.id)
    } catch (err) {
      const ms = typeof (err as { msBeforeNext?: number })?.msBeforeNext === 'number'
        ? (err as { msBeforeNext: number }).msBeforeNext
        : 60000
      const secs = Math.ceil(ms / 1000)
      throw new AppError('RATE_LIMITED', `Too many requests. Please try again in ${secs}s.`, ms)
    }

    const imagePart = { inlineData: { data: data.imageBase64, mimeType: data.mimeType } }
    const result = await generateAndParse([BARCODE_PROMPT, imagePart], barcodeResultSchema)

    if (result.isErr()) {
      throw new AppError('NO_BARCODE', 'No barcode detected in this photo. Make sure the barcode is clearly visible.')
    }

    const food = await lookupOpenFoodFacts(result.value.barcode)
    return { food }
  })

// Manual barcode lookup (no image needed)
const manualBarcodeSchema = z.object({
  barcode: z.string().regex(/^\d{8,14}$/, 'Invalid barcode format'),
})

export const lookupBarcodeFn = createServerFn({ method: 'GET' })
  .inputValidator((d: unknown) => manualBarcodeSchema.parse(d))
  .handler(async ({ data }): Promise<{ food: AnalyzedFood }> => {
    const food = await lookupOpenFoodFacts(data.barcode)
    return { food }
  })
