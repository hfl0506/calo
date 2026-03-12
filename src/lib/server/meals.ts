import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { eq, and, gte, lt } from 'drizzle-orm'
import OpenAI from 'openai'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { z } from 'zod'
import { db } from '#/db'
import { meals, mealFoods } from '#/db/schema'
import { auth } from '#/lib/auth'
import { calcTotals } from '#/lib/nutrition'
import type { AnalyzedFood, MealTag } from '#/lib/types'

function getR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })
}

async function getSession() {
  const req = getRequest()
  const session = await auth.api.getSession({ headers: req.headers })
  return session
}

const analyzeImageSchema = z.object({
  imageBase64: z.string().max(20971520),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
})

export const analyzeImageFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => analyzeImageSchema.parse(data))
  .handler(async ({ data }) => {
    const { imageBase64, mimeType } = data

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are a nutrition expert. Analyze this food image and return a JSON array of every distinct food item visible.

For each item provide your best estimate of the nutrition based on the visible portion size.

Return ONLY a valid JSON array with no markdown fences:
[
  {
    "name": "food name",
    "portionDescription": "e.g. 1 cup, 200g, 1 medium piece",
    "calories": 250,
    "protein": 10.5,
    "carbs": 30.0,
    "fat": 8.0,
    "fiber": 3.0
  }
]

All numeric values must be numbers (not strings). If no food is visible return [].`,
              },
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${imageBase64}` },
              },
            ],
          },
        ],
      })

      const content = response.choices[0]?.message?.content ?? '[]'
      const cleaned = content.replace(/```[a-z]*\n?/gi, '').trim()

      let foods: AnalyzedFood[] = []
      try {
        foods = JSON.parse(cleaned) as AnalyzedFood[]
      } catch {
        return { foods: [] as AnalyzedFood[], error: 'Could not parse nutrition response' }
      }

      if (!foods.length) {
        return { foods: [] as AnalyzedFood[], error: 'No food items detected in the image' }
      }

      return { foods }
    } catch {
      return { foods: [] as AnalyzedFood[], error: 'Failed to analyze image' }
    }
  })

const saveMealSchema = z.object({
  tag: z.enum(['breakfast', 'lunch', 'dinner', 'snacks']),
  foods: z.array(
    z.object({
      name: z.string(),
      portionDescription: z.string().optional(),
      calories: z.number(),
      protein: z.number().optional(),
      carbs: z.number().optional(),
      fat: z.number().optional(),
      fiber: z.number().optional(),
    }),
  ),
  loggedAt: z.string().optional(),
  imageUrl: z.string().optional(),
})

export const saveMealFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => saveMealSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error('Unauthorized')

    const loggedAt = data.loggedAt ? new Date(data.loggedAt) : new Date()

    const [meal] = await db
      .insert(meals)
      .values({
        userId: session.user.id,
        tag: data.tag as MealTag,
        loggedAt,
        imageUrl: data.imageUrl ?? null,
      })
      .returning({ id: meals.id })

    if (!meal) throw new Error('Failed to create meal')

    await db.insert(mealFoods).values(
      data.foods.map((food) => ({
        mealId: meal.id,
        name: food.name,
        portionDescription: food.portionDescription ?? null,
        calories: food.calories.toString(),
        protein: food.protein?.toString() ?? null,
        carbs: food.carbs?.toString() ?? null,
        fat: food.fat?.toString() ?? null,
        fiber: food.fiber?.toString() ?? null,
      })),
    )

    return { mealId: meal.id }
  })

const getMealsByDateSchema = z.object({
  date: z.string().optional(),
})

export const getMealsByDateFn = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => getMealsByDateSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error('Unauthorized')

    const dateStr = data.date ?? new Date().toISOString().split('T')[0]
    const startDate = new Date(`${dateStr}T00:00:00.000Z`)
    const endDate = new Date(`${dateStr}T23:59:59.999Z`)

    const mealRows = await db.query.meals.findMany({
      where: and(
        eq(meals.userId, session.user.id),
        gte(meals.loggedAt, startDate),
        lt(meals.loggedAt, endDate),
      ),
      with: {
        mealFoods: true,
      },
      orderBy: (meals, { desc }) => [desc(meals.loggedAt)],
    })

    return mealRows.map((meal) => ({
      ...meal,
      foods: meal.mealFoods,
      totals: calcTotals(meal.mealFoods),
    }))
  })

const getMealDetailSchema = z.object({
  mealId: z.string().uuid(),
})

export const getMealDetailFn = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => getMealDetailSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error('Unauthorized')

    const meal = await db.query.meals.findFirst({
      where: eq(meals.id, data.mealId),
      with: {
        mealFoods: true,
      },
    })

    if (!meal) throw new Error('Meal not found')
    if (meal.userId !== session.user.id) throw new Error('Unauthorized')

    return {
      ...meal,
      foods: meal.mealFoods,
      totals: calcTotals(meal.mealFoods),
    }
  })

const deleteMealSchema = z.object({
  mealId: z.string().uuid(),
})

export const deleteMealFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => deleteMealSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error('Unauthorized')

    const meal = await db.query.meals.findFirst({
      where: eq(meals.id, data.mealId),
    })

    if (!meal) throw new Error('Meal not found')
    if (meal.userId !== session.user.id) throw new Error('Unauthorized')

    await db.delete(meals).where(eq(meals.id, data.mealId))

    if (meal.imageUrl && process.env.R2_PUBLIC_URL) {
      const key = meal.imageUrl.replace(`${process.env.R2_PUBLIC_URL}/`, '')
      try {
        const r2 = getR2Client()
        await r2.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key }))
      } catch {
        // R2 deletion is best-effort; DB record is already gone
      }
    }

    return { success: true }
  })
