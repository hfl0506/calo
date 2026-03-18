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

// Evaluation thresholds
const NAME_SIMILARITY_THRESHOLD = 0.25;

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

interface ScaledNutrients {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

interface EvaluationResult {
  winner: "gemini" | "usda";
  usdaConfidence: number;
  reasons: string[];
}

// Precompute URL once at module load (safe because usdaApiKey is read from env at import time)
const usdaUrl = usdaApiKey
  ? `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${usdaApiKey}`
  : null;

async function queryUsda(query: string): Promise<UsdaSearchResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
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
      throw new Error(`USDA API error: ${res.status}`);
    }

    return (await res.json()) as UsdaSearchResponse;
  } finally {
    clearTimeout(timeout);
  }
}

/** Tokenize a food name into lowercase words, stripping common filler */
function tokenize(name: string): Set<string> {
  const stopWords = new Set([
    "with", "and", "of", "in", "on", "the", "a", "an",
    "or", "for", "to", "from", "raw", "cooked",
  ]);
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !stopWords.has(w)),
  );
}

/** Jaccard similarity between two token sets (0–1) */
function nameSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  return intersection / (tokensA.size + tokensB.size - intersection);
}

/** How far apart two calorie values are as a ratio (always >= 1) */
function calorieDivergence(a: number, b: number): number {
  if (a <= 0 || b <= 0) return Infinity;
  const ratio = a / b;
  return ratio > 1 ? ratio : 1 / ratio;
}

/** Check if macros are consistent with stated calories (protein*4 + carbs*4 + fat*9) */
function macroCalorieConsistency(n: ScaledNutrients): number {
  if (n.calories <= 0) return 0;
  const computed = n.protein * 4 + n.carbs * 4 + n.fat * 9;
  const ratio = computed / n.calories;
  // 1.0 = perfect, lower = worse
  return 1 - Math.min(Math.abs(ratio - 1), 1);
}

function scaleUsdaNutrients(
  apiFood: UsdaFood,
  weightGrams: number,
): ScaledNutrients {
  const nutrientMap = new Map<number, number>();
  for (const n of apiFood.foodNutrients) {
    nutrientMap.set(n.nutrientId, n.value);
  }

  const scale = weightGrams / 100;
  const get = (id: number) =>
    Math.round((nutrientMap.get(id) ?? 0) * scale * 10) / 10;

  return {
    calories: get(NUTRIENT_ID.ENERGY),
    protein: get(NUTRIENT_ID.PROTEIN),
    carbs: get(NUTRIENT_ID.CARBS),
    fat: get(NUTRIENT_ID.FAT),
    fiber: get(NUTRIENT_ID.FIBER),
  };
}

function evaluate(
  geminiFood: AnalyzedFood,
  apiFood: UsdaFood,
  usdaNutrients: ScaledNutrients,
): EvaluationResult {
  const reasons: string[] = [];
  let usdaConfidence = 0.5; // start neutral

  // 1. Name similarity — most important signal
  const similarity = nameSimilarity(geminiFood.name, apiFood.description);
  const nameMatchGood = similarity >= NAME_SIMILARITY_THRESHOLD;

  if (similarity >= 0.5) {
    usdaConfidence += 0.25;
    reasons.push(`name match strong (${(similarity * 100).toFixed(0)}%)`);
  } else if (nameMatchGood) {
    usdaConfidence += 0.1;
    reasons.push(`name match partial (${(similarity * 100).toFixed(0)}%)`);
  } else {
    usdaConfidence -= 0.3;
    reasons.push(
      `name mismatch: "${geminiFood.name}" vs USDA "${apiFood.description}" (${(similarity * 100).toFixed(0)}%)`,
    );
  }

  // 2. Calorie divergence — interpretation depends on name match
  //    Name match good + calories differ → trust USDA (it found the right food, Gemini estimated wrong)
  //    Name match bad  + calories differ → trust Gemini (USDA matched the wrong food entirely)
  const divergence = calorieDivergence(
    geminiFood.calories,
    usdaNutrients.calories,
  );
  if (divergence <= 1.3) {
    usdaConfidence += 0.15;
    reasons.push(`calories agree (${divergence.toFixed(2)}x)`);
  } else if (nameMatchGood) {
    // USDA found the right food but values differ — USDA database is likely more precise
    usdaConfidence += 0.1;
    reasons.push(
      `calories diverge (${divergence.toFixed(2)}x) but name matched — trusting USDA`,
    );
  } else {
    // USDA matched the wrong food AND values differ — strong signal to reject USDA
    usdaConfidence -= 0.25;
    reasons.push(
      `calories diverge (${divergence.toFixed(2)}x) with name mismatch — rejecting USDA`,
    );
  }

  // 3. USDA macro-calorie consistency (are the macros internally consistent?)
  const usdaConsistency = macroCalorieConsistency(usdaNutrients);
  if (usdaConsistency >= 0.7) {
    usdaConfidence += 0.1;
  } else {
    usdaConfidence -= 0.1;
    reasons.push(
      `USDA macros inconsistent with calories (${(usdaConsistency * 100).toFixed(0)}%)`,
    );
  }

  // Clamp to [0, 1]
  usdaConfidence = Math.max(0, Math.min(1, usdaConfidence));

  const winner = usdaConfidence >= 0.5 ? "usda" : "gemini";
  reasons.push(`→ ${winner} (confidence: ${(usdaConfidence * 100).toFixed(0)}%)`);

  return { winner, usdaConfidence, reasons };
}

function reconcileNutrition(
  geminiFood: AnalyzedFood,
  apiFood: UsdaFood,
): AnalyzedFood {
  const usdaNutrients = scaleUsdaNutrients(
    apiFood,
    geminiFood.estimatedWeightGrams!,
  );

  const evaluation = evaluate(geminiFood, apiFood, usdaNutrients);

  if (process.env.NODE_ENV === "development") {
    console.log(
      `[nutrition-eval] ${geminiFood.name}:`,
      evaluation.reasons.join(" | "),
    );
  }

  if (evaluation.winner === "gemini") {
    return { ...geminiFood, nutritionSource: "gemini" };
  }

  return {
    ...geminiFood,
    ...usdaNutrients,
    nutritionSource: "usda",
  };
}

async function enrichSingleFood(geminiFood: AnalyzedFood): Promise<AnalyzedFood> {
  // Without a weight estimate we can't scale per-100g USDA data — keep Gemini's values
  if (!geminiFood.estimatedWeightGrams) {
    return { ...geminiFood, nutritionSource: "gemini" };
  }

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
    const settled = await Promise.allSettled(
      batch.map((food) => enrichSingleFood(food)),
    );
    for (let j = 0; j < settled.length; j++) {
      const result = settled[j];
      if (result.status === "fulfilled") {
        results[i + j] = result.value;
      } else {
        results[i + j] = { ...batch[j], nutritionSource: "gemini" as const };
      }
    }
  }

  return results;
}
