import type { DayData } from '#/lib/analytics'

function formatBarLabel(dateStr: string, totalDays: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  if (totalDays <= 14) return `${d.getMonth() + 1}/${d.getDate()}`
  return `${d.getDate()}`
}

interface SvgBarChartProps {
  days: DayData[]
  getValue: (d: DayData) => number
  barColor: string
  activeColor: string
  goalValue?: number
  selectedIdx: number | null
  onSelect: (idx: number) => void
}

export function SvgBarChart({
  days,
  getValue,
  barColor,
  activeColor,
  goalValue,
  selectedIdx,
  onSelect,
}: SvgBarChartProps) {
  const W = 320
  const H = 160
  const padL = 34
  const padR = 10
  const padT = 10
  const padB = 26
  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const values = days.map(getValue)
  const maxVal = Math.max(...values, (goalValue ?? 0) * 0.5, 10)
  // Round yMax up to a "nice" number
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)))
  const yMax = Math.max(Math.ceil((maxVal * 1.25) / magnitude) * magnitude, magnitude)

  const toY = (v: number) => padT + chartH - (v / yMax) * chartH
  const slotW = chartW / days.length
  const barW = Math.min(slotW * 0.68, 22)

  const mid = Math.round(yMax / 2 / (magnitude / 2)) * (magnitude / 2)
  const yTicks = [0, mid, yMax]

  const showLabel = (i: number) => {
    if (days.length <= 7) return true
    if (days.length <= 14) return i % 2 === 0
    return i % 5 === 0 || i === days.length - 1
  }

  const formatTick = (v: number) => {
    if (v === 0) return '0'
    if (v >= 1000) return `${v / 1000}k`
    return String(Math.round(v))
  }

  const goalY = goalValue ? toY(goalValue) : null

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" style={{ overflow: 'visible' }}>
      {/* Gridlines + Y labels */}
      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={padL} y1={toY(tick)}
            x2={W - padR} y2={toY(tick)}
            stroke="var(--line)" strokeWidth="0.8"
          />
          <text
            x={padL - 4} y={toY(tick) + 3.5}
            textAnchor="end" fontSize="7" fill="var(--sea-ink-soft)"
          >
            {formatTick(tick)}
          </text>
        </g>
      ))}

      {/* Goal line (calories only) */}
      {goalY !== null && goalY >= padT && goalY <= padT + chartH && (
        <line
          x1={padL} y1={goalY} x2={W - padR} y2={goalY}
          stroke={activeColor} strokeWidth="1" strokeDasharray="4 3" opacity="0.5"
        />
      )}

      {/* Bars */}
      {days.map((day, i) => {
        const val = getValue(day)
        const bx = padL + i * slotW + (slotW - barW) / 2
        const rawBarH = (val / yMax) * chartH
        const barH = val > 0 ? Math.max(rawBarH, 3) : 0
        const by = padT + chartH - barH
        const isSelected = i === selectedIdx
        const isOver = goalValue != null && goalValue > 0 && val > goalValue

        return (
          <g key={day.date} onClick={() => onSelect(i)} style={{ cursor: 'pointer' }}>
            {/* Wide hit area */}
            <rect x={padL + i * slotW} y={padT} width={slotW} height={chartH} fill="transparent" />

            {val > 0 ? (
              <rect
                x={bx} y={by} width={barW} height={barH} rx="3"
                fill={isOver ? 'rgba(239,68,68,0.7)' : barColor}
                opacity={isSelected ? 1 : 0.72}
              />
            ) : (
              <rect
                x={bx} y={padT + chartH - 2} width={barW} height={2} rx="1"
                fill="var(--line)"
              />
            )}

            {/* Selection ring */}
            {isSelected && val > 0 && (
              <rect
                x={bx - 1} y={by - 1} width={barW + 2} height={barH + 2} rx="4"
                fill="none" stroke={activeColor} strokeWidth="1.5"
              />
            )}

            {showLabel(i) && (
              <text
                x={padL + i * slotW + slotW / 2}
                y={padT + chartH + 14}
                textAnchor="middle" fontSize="7"
                fill={isSelected ? activeColor : 'var(--sea-ink-soft)'}
                fontWeight={isSelected ? '700' : '400'}
              >
                {formatBarLabel(day.date, days.length)}
              </text>
            )}
          </g>
        )
      })}

      {/* Axis baseline */}
      <line
        x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH}
        stroke="var(--line)" strokeWidth="1"
      />
    </svg>
  )
}
