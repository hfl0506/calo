import { memo, useState } from 'react'
import { X } from 'lucide-react'
import type { AnalyzedFood } from '#/lib/types'

interface FoodReviewItemProps {
  food: AnalyzedFood
  onChange: (food: AnalyzedFood) => void
  onDelete: () => void
}

export default memo(function FoodReviewItem({ food, onChange, onDelete }: FoodReviewItemProps) {
  const [expanded, setExpanded] = useState(false)

  const update = (field: keyof AnalyzedFood, value: string | number) => {
    onChange({ ...food, [field]: value })
  }

  return (
    <div className="island-shell rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-2">
          {/* Food name */}
          <input
            type="text"
            value={food.name}
            onChange={(e) => update('name', e.target.value)}
            className="w-full rounded-lg border border-transparent bg-transparent text-base font-semibold text-[var(--sea-ink)] outline-none transition focus:border-[rgba(79,184,178,0.6)] focus:bg-white focus:px-2 dark:focus:bg-neutral-900"
          />

          {/* Portion */}
          <input
            type="text"
            value={food.portionDescription}
            onChange={(e) => update('portionDescription', e.target.value)}
            placeholder="Portion size"
            className="w-full rounded-lg border border-transparent bg-transparent text-base text-[var(--sea-ink-soft)] outline-none transition focus:border-[rgba(79,184,178,0.6)] focus:bg-white focus:px-2 dark:focus:bg-neutral-900"
          />

          {/* Macro summary row */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-[var(--sea-ink)]">
              {Math.round(food.calories)} kcal
            </span>
            <span className="text-xs text-[var(--sea-ink-soft)]">
              P: {Math.round(food.protein)}g
            </span>
            <span className="text-xs text-[var(--sea-ink-soft)]">
              C: {Math.round(food.carbs)}g
            </span>
            <span className="text-xs text-[var(--sea-ink-soft)]">
              F: {Math.round(food.fat)}g
            </span>
          </div>

          {/* Expand/collapse macro edit */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              className="text-xs text-[var(--lagoon-deep)] transition hover:opacity-80"
            >
              {expanded ? '▲ Hide details' : '▼ Edit macros'}
            </button>
          </div>

          {expanded && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <MacroInput
                label="Calories"
                value={food.calories}
                onChange={(v) => update('calories', v)}
              />
              <MacroInput
                label="Protein (g)"
                value={food.protein}
                onChange={(v) => update('protein', v)}
              />
              <MacroInput
                label="Carbs (g)"
                value={food.carbs}
                onChange={(v) => update('carbs', v)}
              />
              <MacroInput
                label="Fat (g)"
                value={food.fat}
                onChange={(v) => update('fat', v)}
              />
              <MacroInput
                label="Fiber (g)"
                value={food.fiber}
                onChange={(v) => update('fiber', v)}
              />
            </div>
          )}
        </div>

        {/* Delete button */}
        <button
          type="button"
          onClick={onDelete}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--sea-ink-soft)] transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
          aria-label="Delete food item"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
})

function MacroInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-0.5">
      <label className="text-xs text-[var(--sea-ink-soft)]">{label}</label>
      <input
        type="number"
        value={value}
        min={0}
        onChange={(e) => {
          const n = parseFloat(e.target.value)
          onChange(isFinite(n) && n >= 0 ? n : 0)
        }}
        className="w-full rounded-lg border border-[rgba(50,143,151,0.3)] bg-white px-2 py-1 text-base text-[var(--sea-ink)] outline-none transition focus:border-[rgba(79,184,178,0.6)] focus:ring-1 focus:ring-[rgba(79,184,178,0.4)] dark:bg-neutral-900"
      />
    </div>
  )
}
