interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

const SIZE_CLASS = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-8 w-8',
} as const

export function LoadingSpinner({ size = 'md', label }: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label ?? 'Loading'}
      className={`${SIZE_CLASS[size]} animate-spin rounded-full border-2 border-[var(--lagoon-deep)] border-t-transparent`}
    />
  )
}
