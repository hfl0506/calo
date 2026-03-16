import type { MealTag } from '#/lib/types'

interface MealTagPickerProps {
  value: MealTag
  onChange: (tag: MealTag) => void
}

const TAGS = [
  { value: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { value: 'lunch', label: 'Lunch', emoji: '☀️' },
  { value: 'dinner', label: 'Dinner', emoji: '🌙' },
  { value: 'snacks', label: 'Snacks', emoji: '🍎' },
] as const

export default function MealTagPicker({ value, onChange }: MealTagPickerProps) {
  return (
    <div className="flex gap-2">
      {TAGS.map((tag) => {
        const isSelected = value === tag.value
        return (
          <button
            key={tag.value}
            type="button"
            onClick={() => onChange(tag.value)}
            className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2 text-xs font-semibold transition ${
              isSelected
                ? 'border-[var(--lagoon-deep)] bg-[var(--lagoon-deep)] text-white'
                : 'border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink-soft)] hover:border-[var(--lagoon-deep)] hover:text-[var(--sea-ink)]'
            }`}
          >
            <span className="text-base">{tag.emoji}</span>
            <span>{tag.label}</span>
          </button>
        )
      })}
    </div>
  )
}
