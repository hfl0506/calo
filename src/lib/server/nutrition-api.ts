import pRetry from "p-retry";
import { usdaApiKey } from "#/lib/env";
import type { AnalyzedFood } from "#/lib/types";

const NUTRIENT_ID = {
  ENERGY: 1008,
  PROTEIN: 1003,
  CARBS: 1005,
  FAT: 1004,
  FIBER: 1079,
} as const;

const MAX_CONCURRENT = 3;

interface UsdaNutrient {
  nutrientId: number;
  value: number;
}

interface UsdaFood {
  description: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients: UsdaNutrient[];
}

interface UsdaSearchResponse {
  foods: UsdaFood[];
}

// Precompute URL once at module load (safe because usdaApiKey is read from env at import time)
const usdaUrl = usdaApiKey
  ? `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${usdaApiKey}`
  : null;

async function queryUsda(query: string): Promise<UsdaSearchResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    console.log(`[USDA API] Querying: "${query}"`);
    const res = await fetch(usdaUrl!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        pageSize: 1,
        dataType: ["Survey (FNDDS)", "Foundation", "SR Legacy"],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error(`[USDA API] Error: ${res.status} ${res.statusText}`);
      throw new Error(`USDA API error: ${res.status}`);
    }

    const data = (await res.json()) as UsdaSearchResponse;
    console.log(`[USDA API] Got ${data.foods.length} result(s) for "${query}"`);
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function reconcileNutrition(
  geminiFood: AnalyzedFood,
  apiFood: UsdaFood,
): AnalyzedFood {
  // Build lookup map once instead of scanning array per nutrient
  const nutrientMap = new Map<number, number>();
  for (const n of apiFood.foodNutrients) {
    nutrientMap.set(n.nutrientId, n.value);
  }

  // USDA nutrients are per 100g — scale to Gemini's estimated portion weight
  const scale = (geminiFood.estimatedWeightGrams ?? 100) / 100;
  const get = (id: number) => Math.round((nutrientMap.get(id) ?? 0) * scale * 10) / 10;

  return {
    ...geminiFood,
    calories: get(NUTRIENT_ID.ENERGY),
    protein: get(NUTRIENT_ID.PROTEIN),
    carbs: get(NUTRIENT_ID.CARBS),
    fat: get(NUTRIENT_ID.FAT),
    fiber: get(NUTRIENT_ID.FIBER),
    nutritionSource: "usda",
  };
}

async function enrichSingleFood(geminiFood: AnalyzedFood): Promise<AnalyzedFood> {
  const query = geminiFood.portionDescription
    ? `${geminiFood.portionDescription} ${geminiFood.name}`
    : geminiFood.name;

  const response = await pRetry(() => queryUsda(query), { retries: 1 });
  const apiFood = response.foods[0];

  if (!apiFood) return { ...geminiFood, nutritionSource: "gemini" };
  return reconcileNutrition(geminiFood, apiFood);
}

export async function enrichWithNutritionAPI(
  foods: AnalyzedFood[],
): Promise<AnalyzedFood[]> {
  if (!usdaUrl) return foods;

  const results: AnalyzedFood[] = new Array(foods.length);

  // Process in batches to avoid hammering the API
  for (let i = 0; i < foods.length; i += MAX_CONCURRENT) {
    const batch = foods.slice(i, i + MAX_CONCURRENT);
    const batchResults = await Promise.all(
      batch.map(async (food) => {
        try {
          return await enrichSingleFood(food);
        } catch (err) {
          console.error(`[USDA API] Failed for "${food.name}":`, err);
          return { ...food, nutritionSource: "gemini" as const };
        }
      }),
    );
    for (let j = 0; j < batchResults.length; j++) {
      results[i + j] = batchResults[j];
    }
  }

  return results;
}
