import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
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
  nutrition_grades?: string
}

const barcodeSchema = z.object({
  barcode: z.string().regex(/^\d{8,14}$/, 'Invalid barcode format'),
})

export const lookupBarcodeFn = createServerFn({ method: 'GET' })
  .inputValidator((d: unknown) => barcodeSchema.parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${data.barcode}?fields=product_name,nutriments,serving_size,nutrition_grades`,
      {
        headers: { 'User-Agent': 'Calo/1.0 (calorie-tracker)' },
        signal: AbortSignal.timeout(8000),
      },
    )

    if (!res.ok) {
      throw new Error('Failed to fetch product info')
    }

    const json = (await res.json()) as { status: number; product?: OpenFoodFactsProduct }

    if (json.status !== 1 || !json.product) {
      throw new Error('Product not found. Try another barcode or use photo/text input instead.')
    }

    const p = json.product
    const n = p.nutriments ?? {}

    const name = p.product_name || 'Unknown product'
    const serving = p.serving_size || '100g'

    // Use per-100g values as base, adjust if serving size is specified
    const calories = n['energy-kcal_100g'] ?? 0
    const protein = n.proteins_100g ?? 0
    const carbs = n.carbohydrates_100g ?? 0
    const fat = n.fat_100g ?? 0
    const fiber = n.fiber_100g ?? 0

    const food: AnalyzedFood = {
      name,
      portionDescription: `1 serving (${serving})`,
      calories: Math.round(calories),
      protein: Math.round(protein * 10) / 10,
      carbs: Math.round(carbs * 10) / 10,
      fat: Math.round(fat * 10) / 10,
      fiber: Math.round(fiber * 10) / 10,
      nutritionSource: 'usda' as const,
    }

    return { food }
  })
