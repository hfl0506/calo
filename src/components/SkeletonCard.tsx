import Skeleton, { SkeletonTheme } from 'react-loading-skeleton'

function Themed({ children }: { children: React.ReactNode }) {
  return (
    <SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
      {children}
    </SkeletonTheme>
  )
}

// Matches the meal row used on both Home and History:
// [square thumb] [name / foods]  [kcal / time]
function MealRowSkeleton() {
  return (
    <div className="island-shell flex items-center gap-3 rounded-2xl p-4">
      <Skeleton width={48} height={48} borderRadius={10} />
      <div className="flex flex-1 items-center justify-between gap-2">
        <div className="space-y-1.5">
          <Skeleton width={88} height={13} borderRadius={6} />
          <Skeleton width={148} height={11} borderRadius={6} />
        </div>
        <div className="flex flex-col items-end space-y-1.5">
          <Skeleton width={56} height={13} borderRadius={6} />
          <Skeleton width={44} height={11} borderRadius={6} />
        </div>
      </div>
    </div>
  )
}

export function HomeSkeleton() {
  return (
    <Themed>
      <div className="px-4 py-6 pb-24 space-y-6">

        {/* Summary card */}
        <div className="island-shell rounded-2xl p-5 space-y-4">
          {/* "Today's Summary" */}
          <Skeleton width={128} height={14} borderRadius={6} />

          {/* "312 / 2000 kcal" */}
          <div className="flex items-end gap-2">
            <Skeleton width={80} height={44} borderRadius={8} />
            <Skeleton width={80} height={16} borderRadius={6} />
          </div>

          {/* Progress bar */}
          <Skeleton height={8} borderRadius={99} />

          {/* Protein / Carbs / Fat chips */}
          <div className="grid grid-cols-3 gap-3">
            <Skeleton height={56} borderRadius={12} />
            <Skeleton height={56} borderRadius={12} />
            <Skeleton height={56} borderRadius={12} />
          </div>

          {/* Tag breakdown row: emoji chip + label */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center gap-1">
              <Skeleton width={28} height={28} borderRadius={6} />
              <Skeleton width={28} height={11} borderRadius={6} />
              <Skeleton width={48} height={11} borderRadius={6} />
            </div>
          </div>
        </div>

        {/* "Today's meals" label */}
        <Skeleton width={96} height={13} borderRadius={6} />

        {/* Meal rows */}
        <div className="space-y-3">
          <MealRowSkeleton />
          <MealRowSkeleton />
          <MealRowSkeleton />
        </div>

      </div>
    </Themed>
  )
}

export function MealDetailSkeleton() {
  return (
    <Themed>
      <div className="space-y-4">

        {/* Meal header card: [emoji circle]  [tag name / datetime] */}
        <div className="island-shell rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <Skeleton circle width={44} height={44} />
            <div className="space-y-2">
              <Skeleton width={72} height={16} borderRadius={6} />
              <Skeleton width={120} height={12} borderRadius={6} />
            </div>
          </div>
        </div>

        {/* Meal image — h-48 */}
        <Skeleton height={192} borderRadius={16} />

        {/* Nutrition totals card */}
        <div className="island-shell rounded-2xl p-4 space-y-3">
          <Skeleton width={112} height={13} borderRadius={6} />
          <div className="grid grid-cols-4 gap-3">
            <Skeleton height={68} borderRadius={12} />
            <Skeleton height={68} borderRadius={12} />
            <Skeleton height={68} borderRadius={12} />
            <Skeleton height={68} borderRadius={12} />
          </div>
        </div>

        {/* Foods section */}
        <div className="space-y-2">
          <Skeleton width={64} height={13} borderRadius={6} />
          {[0, 1, 2].map((i) => (
            <div key={i} className="island-shell rounded-2xl p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton width={120} height={13} borderRadius={6} />
                  <Skeleton width={88} height={11} borderRadius={6} />
                  <div className="flex gap-3 mt-1">
                    <Skeleton width={36} height={11} borderRadius={6} />
                    <Skeleton width={36} height={11} borderRadius={6} />
                    <Skeleton width={36} height={11} borderRadius={6} />
                  </div>
                </div>
                <Skeleton width={52} height={13} borderRadius={6} />
              </div>
            </div>
          ))}
        </div>

      </div>
    </Themed>
  )
}

export function HistorySkeleton() {
  return (
    <Themed>
      <div className="space-y-6">

        {[0, 1].map((g) => (
          <div key={g}>
            {/* Sticky date header: "Today / Yesterday"  +  "312 kcal" + pie icon */}
            <div className="flex items-center justify-between py-2">
              <Skeleton width={72} height={14} borderRadius={6} />
              <div className="flex items-center gap-2">
                <Skeleton width={56} height={12} borderRadius={6} />
                <Skeleton width={28} height={28} borderRadius={8} />
              </div>
            </div>

            {/* Meal rows */}
            <div className="space-y-2">
              <MealRowSkeleton />
              <MealRowSkeleton />
              <MealRowSkeleton />
            </div>
          </div>
        ))}

      </div>
    </Themed>
  )
}
