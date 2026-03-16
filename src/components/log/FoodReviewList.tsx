import { memo, useCallback, useRef } from 'react'
import type { AnalyzedFood } from '#/lib/types'
import { generateId } from '#/lib/uuid'
import FoodReviewItem from './FoodReviewItem'

interface FoodReviewListProps {
  foods: AnalyzedFood[]
  onChange: (foods: AnalyzedFood[]) => void
}

export default memo(function FoodReviewList({ foods, onChange }: FoodReviewListProps) {
  // Stable ref so callbacks don't close over stale `foods`
  const foodsRef = useRef(foods)
  foodsRef.current = foods

  const handleChange = useCallback((index: number, food: AnalyzedFood) => {
    const updated = [...foodsRef.current]
    updated[index] = food
    onChange(updated)
  }, [onChange])

  const handleDelete = useCallback((index: number) => {
    onChange(foodsRef.current.filter((_, i) => i !== index))
  }, [onChange])

  const handleAddManual = useCallback(() => {
    const emptyFood: AnalyzedFood = {
      id: generateId(),
      name: '',
      portionDescription: '',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
    }
    onChange([...foodsRef.current, emptyFood])
  }, [onChange])

  return (
    <div className="space-y-3">
      {foods.map((food, index) => (
        <FoodReviewItem
          key={food.id}
          food={food}
          onChange={(updated) => handleChange(index, updated)}
          onDelete={() => handleDelete(index)}
        />
      ))}

      <button
        type="button"
        onClick={handleAddManual}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--lagoon-deep)] text-sm font-medium text-[var(--lagoon-deep)] transition hover:bg-[rgba(79,184,178,0.06)]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add food manually
      </button>
    </div>
  )
})
