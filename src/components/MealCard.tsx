import { memo } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { prefetchMealDetail } from '#/lib/meal-prefetch-cache'
import { formatTime } from '#/lib/format'
import { MEAL_TAG_EMOJI, MEAL_TAG_LABEL } from '#/lib/types'
import type { Meal } from '#/lib/types'

interface MealCardProps {
  meal: Meal
  /** Show the meal image (used on home page). Defaults to false. */
  showImage?: boolean
  /** Image loading priority. Defaults to 'lazy'. */
  imageLoading?: 'eager' | 'lazy'
  /** Whether to show a chevron indicator. Defaults to false. */
  showChevron?: boolean
}

export const MealCard = memo(function MealCard({ meal, showImage = false, imageLoading = 'lazy', showChevron = false }: MealCardProps) {
  return (
    <Link
      to="/history/$mealId"
      params={{ mealId: meal.id }}
      className={`island-shell ${showImage ? 'block' : 'flex items-center gap-3'} overflow-hidden rounded-2xl transition hover:shadow-lg`}
      onMouseEnter={() => prefetchMealDetail(meal.id)}
      onTouchStart={() => prefetchMealDetail(meal.id)}
    >
      {showImage && meal.imageUrl && (
        <img
          src={meal.imageUrl}
          alt={MEAL_TAG_LABEL[meal.tag]}
          className="h-36 w-full object-cover"
          loading={imageLoading}
          decoding="async"
          fetchPriority={imageLoading === 'eager' ? 'high' : 'low'}
        />
      )}
      {!showImage && <span className="text-2xl">{MEAL_TAG_EMOJI[meal.tag]}</span>}
      <div className={`flex items-center gap-3 ${showImage ? 'p-4' : 'flex-1'}`}>
        {showImage && <span className="text-2xl">{MEAL_TAG_EMOJI[meal.tag]}</span>}
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--sea-ink)]">
              {MEAL_TAG_LABEL[meal.tag]}
            </span>
            <span className="text-sm font-bold text-[var(--sea-ink)]">
              {Math.round(meal.totals.calories)} kcal
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--sea-ink-soft)]">
              {meal.foods
                .slice(0, 2)
                .map((f) => f.name)
                .join(', ')}
              {meal.foods.length > 2 ? ` +${meal.foods.length - 2} more` : ''}
            </span>
            <span className="text-xs text-[var(--sea-ink-soft)]">
              {formatTime(meal.loggedAt)}
            </span>
          </div>
        </div>
      </div>
      {showChevron && (
        <ChevronRight size={16} className="text-[var(--sea-ink-soft)]" />
      )}
    </Link>
  )
})
