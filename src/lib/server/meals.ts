import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { eq, and, gte, lt, sql } from "drizzle-orm";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { z } from "zod";
import { db } from "#/db";
import { meals, mealFoods } from "#/db/schema";
import { calcTotals } from "#/lib/nutrition";
import { getSession } from "#/lib/server/session";
import { getR2Client } from "#/lib/server/r2";
import {
  analyzeRateLimiter,
  recalculateRateLimiter,
} from "#/lib/server/rate-limit";
import { RateLimiterRes } from "rate-limiter-flexible";
import {
  generateAndParse,
  generateAndParseWithNotFoodGuard,
} from "#/lib/server/gemini";
import { AppError } from "#/lib/server/errors";

import type { AnalyzedFood, Meal } from "#/lib/types";
import { localDateToUTC } from "#/lib/timezone";
import { env } from "#/lib/env";
import { ANALYZE_TEXT_PROMPT, ANALYZE_IMAGE_PROMPT, RECALCULATE_PROMPT } from "#/lib/server/prompts";

function throwRateLimitError(err: unknown): never {
  const ms = err instanceof RateLimiterRes ? err.msBeforeNext : 60000;
  const secs = Math.ceil(ms / 1000);
  throw new AppError(
    'RATE_LIMITED',
    `Too many requests. Please try again in ${secs} second${secs !== 1 ? "s" : ""}.`,
    ms,
  );
}

const timezoneSchema = z.string().refine(
  (tz) => { try { Intl.DateTimeFormat(undefined, { timeZone: tz }); return true } catch { return false } },
  { message: "Invalid timezone" }
);

async function resolveTimezone(fallbackTz?: string): Promise<string> {
  if (fallbackTz) return fallbackTz;
  try {
    const req = getRequest();
    const cookieHeader = req.headers.get("cookie") ?? "";
    const tzCookie = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith("tz="));
    if (tzCookie) return decodeURIComponent(tzCookie.slice(3));
  } catch { /* client navigation: no server request context */ }
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// Zod schemas for validating Gemini JSON responses
const analyzedFoodSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  portionDescription: z.string().default(""),
  calories: z.number(),
  protein: z.number().default(0),
  carbs: z.number().default(0),
  fat: z.number().default(0),
  fiber: z.number().default(0),
});

const analyzedFoodsArraySchema = z.array(analyzedFoodSchema);

const analyzePromptSchema = z.object({
  prompt: z.string().min(1).max(500),
});

const recalculateSchema = z.object({
  originalName: z.string(),
  adjustmentPrompt: z.string().min(1).max(200),
  portionDescription: z.string().optional(),
});

export const recalculateNutritionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => recalculateSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session) throw new AppError('UNAUTHORIZED', 'Unauthorized');

    try {
      await recalculateRateLimiter.consume(session.user.id);
    } catch (err) {
      throwRateLimitError(err);
    }

    const prompt = RECALCULATE_PROMPT(data.originalName, data.portionDescription ?? "standard serving", data.adjustmentPrompt);

    const result = await generateAndParse(prompt, analyzedFoodSchema);
    if (result.isErr()) throw new AppError('ANALYSIS_FAILED', 'Failed to recalculate nutrition');
    return { food: result.value };
  });

export const analyzePromptFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => analyzePromptSchema.parse(data))
  .handler(async ({ data }): Promise<{ foods: AnalyzedFood[] }> => {
    const session = await getSession();
    if (!session) throw new AppError('UNAUTHORIZED', 'Unauthorized');

    try {
      await analyzeRateLimiter.consume(session.user.id);
    } catch (err) {
      throwRateLimitError(err);
    }

    const result = await generateAndParseWithNotFoodGuard(
      ANALYZE_TEXT_PROMPT(data.prompt),
      analyzedFoodsArraySchema,
    );

    if (result.isErr()) {
      const err = result.error;
      if (err.type === 'not_food') {
        throw new AppError('NOT_FOOD', 'Please describe a food or meal. I can only help with food-related prompts.');
      }
      throw new AppError('ANALYSIS_FAILED', 'Failed to analyze your description. Please try again.');
    }

    if (result.value.length === 0) {
      throw new AppError('NO_ITEMS', 'No food items detected. Try describing what you ate, e.g. "a bowl of rice with grilled chicken".');
    }

    return { foods: result.value };
  });

const analyzeImageSchema = z.object({
  imageBase64: z.string().max(20971520),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

export const analyzeImageFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => analyzeImageSchema.parse(data))
  .handler(async ({ data }): Promise<{ foods: AnalyzedFood[] }> => {
    const session = await getSession();
    if (!session) throw new AppError('UNAUTHORIZED', 'Unauthorized');

    try {
      await analyzeRateLimiter.consume(session.user.id);
    } catch (err) {
      throwRateLimitError(err);
    }

    const imagePart = { inlineData: { data: data.imageBase64, mimeType: data.mimeType } };
    const result = await generateAndParse([ANALYZE_IMAGE_PROMPT, imagePart], analyzedFoodsArraySchema);

    if (result.isErr()) {
      console.error("[analyzeImageFn] Gemini error:", result.error);
      throw new AppError('ANALYSIS_FAILED', 'Failed to analyze image. Please try again.');
    }

    if (result.value.length === 0) {
      throw new AppError('NO_ITEMS', 'No food items detected in the image');
    }

    return { foods: result.value };
  });

const finiteNonNegative = z.number().finite().nonnegative();

const saveMealSchema = z.object({
  tag: z.enum(["breakfast", "lunch", "dinner", "snacks"]),
  foods: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        portionDescription: z.string().max(200).optional(),
        calories: finiteNonNegative,
        protein: finiteNonNegative.optional(),
        carbs: finiteNonNegative.optional(),
        fat: finiteNonNegative.optional(),
        fiber: finiteNonNegative.optional(),
      }),
    )
    .min(1)
    .max(50),
  loggedAt: z.string().optional(),
  imageUrl: z.string().url().optional(),
  notes: z.string().max(500).optional(),
});

export const saveMealFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => saveMealSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session) throw new AppError('UNAUTHORIZED', 'Unauthorized');

    const loggedAt = data.loggedAt ? new Date(data.loggedAt) : new Date();

    const mealId = await db.transaction(async (tx) => {
      const [meal] = await tx
        .insert(meals)
        .values({
          userId: session.user.id,
          tag: data.tag,
          loggedAt,
          imageUrl: data.imageUrl ?? null,
          notes: data.notes ?? null,
        })
        .returning({ id: meals.id });

      if (!meal) throw new Error("Failed to create meal");

      await tx.insert(mealFoods).values(
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
      );

      return meal.id;
    });

    return { mealId };
  });

const getMealsByDateSchema = z.object({
  date: z.string().optional(),
  timezone: timezoneSchema.optional(),
});

export const getMealsByDateFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getMealsByDateSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session) throw new AppError('UNAUTHORIZED', 'Unauthorized');

    const tz = await resolveTimezone(data.timezone);

    const dateStr =
      data.date ?? new Date().toLocaleDateString("en-CA", { timeZone: tz });

    const startDate = localDateToUTC(`${dateStr}T00:00:00`, tz);
    const endDate = localDateToUTC(`${dateStr}T23:59:59.999`, tz);

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
      limit: 200,
    });

    const result: Meal[] = mealRows.map(({ mealFoods, ...meal }) => ({
      ...meal,
      foods: mealFoods,
      totals: calcTotals(mealFoods),
    }));
    return result;
  });

const getMealsRangeSchema = z.object({
  startDate: z.string(), // YYYY-MM-DD
  endDate: z.string(), // YYYY-MM-DD
  timezone: timezoneSchema.optional(),
});

export const getMealsRangeFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getMealsRangeSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session) throw new AppError('UNAUTHORIZED', 'Unauthorized');

    const tz = await resolveTimezone(data.timezone);
    const startDate = localDateToUTC(`${data.startDate}T00:00:00`, tz);
    const endDate = localDateToUTC(`${data.endDate}T23:59:59.999`, tz);

    const mealRows = await db.query.meals.findMany({
      where: and(
        eq(meals.userId, session.user.id),
        gte(meals.loggedAt, startDate),
        lt(meals.loggedAt, endDate),
      ),
      with: { mealFoods: true },
      orderBy: (meals, { desc }) => [desc(meals.loggedAt)],
      limit: 2000,
    });

    const result: Meal[] = mealRows.map(({ mealFoods, ...meal }) => ({
      ...meal,
      foods: mealFoods,
      totals: calcTotals(mealFoods),
    }));
    return result;
  });

const getMealDetailSchema = z.object({
  mealId: z.string().uuid(),
});

export const getMealDetailFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getMealDetailSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session) throw new AppError('UNAUTHORIZED', 'Unauthorized');

    const meal = await db.query.meals.findFirst({
      where: and(eq(meals.id, data.mealId), eq(meals.userId, session.user.id)),
      with: { mealFoods: true },
    });

    if (!meal) throw new AppError('NOT_FOUND', 'Meal not found');

    const { mealFoods, ...mealData } = meal;
    return {
      ...mealData,
      foods: mealFoods,
      totals: calcTotals(mealFoods),
    };
  });

const updateMealSchema = z.object({
  mealId: z.string().uuid(),
  notes: z.string().max(500).optional(),
  foods: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        portionDescription: z.string().max(200).optional(),
        calories: finiteNonNegative,
        protein: finiteNonNegative.optional(),
        carbs: finiteNonNegative.optional(),
        fat: finiteNonNegative.optional(),
        fiber: finiteNonNegative.optional(),
      }),
    )
    .min(1)
    .max(50),
});

export const updateMealFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateMealSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session) throw new AppError('UNAUTHORIZED', 'Unauthorized');

    await db.transaction(async (tx) => {
      const updated = await tx
        .update(meals)
        .set({ notes: data.notes ?? null })
        .where(
          and(eq(meals.id, data.mealId), eq(meals.userId, session.user.id)),
        )
        .returning({ id: meals.id });

      if (!updated.length) throw new AppError('NOT_FOUND', 'Meal not found');

      await tx.delete(mealFoods).where(eq(mealFoods.mealId, data.mealId));

      await tx.insert(mealFoods).values(
        data.foods.map((food) => ({
          mealId: data.mealId,
          name: food.name,
          portionDescription: food.portionDescription ?? null,
          calories: food.calories.toString(),
          protein: food.protein?.toString() ?? null,
          carbs: food.carbs?.toString() ?? null,
          fat: food.fat?.toString() ?? null,
          fiber: food.fiber?.toString() ?? null,
        })),
      );
    });

    return { success: true };
  });

export const getStreakFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await getSession();
    if (!session) throw new AppError('UNAUTHORIZED', 'Unauthorized');

    const tz = await resolveTimezone();

    // Use SQL to get distinct dates directly instead of fetching all rows
    const rows = await db
      .selectDistinct({
        date: sql<string>`(${meals.loggedAt} AT TIME ZONE ${tz})::date::text`,
      })
      .from(meals)
      .where(
        and(
          eq(meals.userId, session.user.id),
          gte(meals.loggedAt, sql`now() - interval '365 days'`),
        ),
      );

    const datesWithMeals = new Set(rows.map((r) => r.date));

    let streak = 0;
    const cur = new Date();
    const today = cur.toLocaleDateString("en-CA", { timeZone: tz });
    if (!datesWithMeals.has(today)) {
      cur.setDate(cur.getDate() - 1);
    }
    for (let i = 0; i <= 365; i++) {
      const d = cur.toLocaleDateString("en-CA", { timeZone: tz });
      if (!datesWithMeals.has(d)) break;
      streak++;
      cur.setDate(cur.getDate() - 1);
    }

    return { streak };
  },
);

const deleteMealSchema = z.object({
  mealId: z.string().uuid(),
});

export const deleteMealFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => deleteMealSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session) throw new AppError('UNAUTHORIZED', 'Unauthorized');

    const [deleted] = await db
      .delete(meals)
      .where(and(eq(meals.id, data.mealId), eq(meals.userId, session.user.id)))
      .returning({ imageUrl: meals.imageUrl });

    if (!deleted) throw new AppError('NOT_FOUND', 'Meal not found');

    if (deleted.imageUrl) {
      const key = deleted.imageUrl.replace(`${env.R2_PUBLIC_URL}/`, "");
      try {
        const r2 = getR2Client();
        await r2.send(
          new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }),
        );
      } catch (err) {
        console.error("[deleteMealFn] R2 deletion failed for key:", key, err);
      }
    }

    return { success: true };
  });
