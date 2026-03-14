import { memo, useMemo } from 'react'
import type { AnalyzedFood } from '#/lib/types'

interface NutritionSummaryBarProps {
  foods: AnalyzedFood[]
}

export default memo(function NutritionSummaryBar({ foods }: NutritionSummaryBarProps) {
  const totals = useMemo(() => foods.reduce(
    (acc, food) => ({
      calories: acc.calories + (food.calories ?? 0),
      protein: acc.protein + (food.protein ?? 0),
      carbs: acc.carbs + (food.carbs ?? 0),
      fat: acc.fat + (food.fat ?? 0),
      fiber: acc.fiber + (food.fiber ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  ), [foods])

  return (
    <div className="island-shell sticky top-14 z-10 rounded-none border-x-0 border-t-0 px-4 py-3">
      <div className="flex items-center gap-4">
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-[var(--sea-ink)]">
            {Math.round(totals.calories)}
          </span>
          <span className="text-xs text-[var(--sea-ink-soft)]">kcal</span>
        </div>

        <div className="h-8 w-px bg-[var(--line)]" />

        <div className="flex flex-1 justify-between">
          <MacroChip label="Protein" value={totals.protein} unit="g" />
          <MacroChip label="Carbs" value={totals.carbs} unit="g" />
          <MacroChip label="Fat" value={totals.fat} unit="g" />
          <MacroChip label="Fiber" value={totals.fiber} unit="g" />
        </div>
      </div>
    </div>
  )
})

function MacroChip({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-sm font-semibold text-[var(--sea-ink)]">
        {Math.round(value * 10) / 10}
        <span className="text-xs font-normal text-[var(--sea-ink-soft)]">{unit}</span>
      </span>
      <span className="text-xs text-[var(--sea-ink-soft)]">{label}</span>
    </div>
  )
}
