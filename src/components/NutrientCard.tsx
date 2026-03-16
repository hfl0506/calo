interface NutrientCardProps {
  label: string
  value: number
  unit: string
  large?: boolean
}

export function NutrientCard({ label, value, unit, large }: NutrientCardProps) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-[var(--chip-bg)] p-2 text-center">
      <span className={`font-bold text-[var(--sea-ink)] ${large ? 'text-xl' : 'text-base'}`}>{value}</span>
      <span className="text-xs text-[var(--sea-ink-soft)]">{unit}</span>
      <span className="text-xs text-[var(--sea-ink-soft)]">{label}</span>
    </div>
  )
}
