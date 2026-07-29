import React from 'react'
import { CardShell, SkeletonCard } from './ui/CardShell'

function scoreColor(score) {
  if (score >= 75) return { stroke: '#16a34a', text: 'text-brand-600 dark:text-brand-400', label: 'Excellent' }
  if (score >= 50) return { stroke: '#2563eb', text: 'text-blue-600 dark:text-blue-400',  label: 'Good'      }
  if (score >= 30) return { stroke: '#d97706', text: 'text-amber-600 dark:text-amber-400', label: 'Fair'     }
  return              { stroke: '#dc2626', text: 'text-red-600 dark:text-red-400',          label: 'Poor'     }
}

// SVG arc gauge
// Design: arc from 140° (lower-left) to 40° (lower-right) sweeping CW via 270° (top) = 260°.
// This keeps all arc points within the 160×120 viewBox (max y ≈ 119, min y = 20).
const START_DEG = 140
const END_DEG   = 40
const TOTAL_DEG = 260   // 260° CW from 140° → 270° (top) → 40°

function Gauge({ score }) {
  const r    = 60
  const cx   = 80
  const cy   = 80
  const size = 160
  const toRad = d => (d * Math.PI) / 180
  const pt    = d => ({ x: cx + r * Math.cos(toRad(d)), y: cy + r * Math.sin(toRad(d)) })

  const start      = pt(START_DEG)
  const end        = pt(END_DEG)
  const filledDeg  = START_DEG + (score / 100) * TOTAL_DEG
  const filled     = pt(filledDeg)
  const largeArc   = filledDeg - START_DEG > 180 ? 1 : 0
  const { stroke, text, label } = scoreColor(score)

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size * 0.85} viewBox={`0 0 ${size} ${size * 0.85}`} overflow="visible" aria-hidden="true">
        {/* Background track: CW from 140° to 40°, large arc (260°) */}
        <path
          d={`M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${end.x} ${end.y}`}
          fill="none"
          stroke="currentColor"
          className="text-gray-200 dark:text-gray-700"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Filled arc */}
        {score > 0 && (
          <path
            d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${filled.x} ${filled.y}`}
            fill="none"
            stroke={stroke}
            strokeWidth="12"
            strokeLinecap="round"
          />
        )}
        {/* Score text — positioned in the visual centre of the D-shape */}
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="28" fontWeight="700"
              className="fill-gray-900 dark:fill-gray-50">
          {Math.round(score)}
        </text>
        <text x={cx} y={cy + 20} textAnchor="middle" fontSize="11"
              className="fill-gray-400 dark:fill-gray-500">
          / 100
        </text>
      </svg>
      <span className={`text-[15px] font-bold ${text}`}>{label}</span>
    </div>
  )
}

export default function HealthScoreGauge({ data, loading }) {
  if (loading) {
    return (
      <SkeletonCard label="Loading financial health score" headerWidth="w-48">
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-32 h-24 bg-gray-100 dark:bg-gray-800 rounded-full animate-pulse" />
          <div className="h-4 w-24 bg-gray-100 dark:bg-gray-800 rounded" />
        </div>
      </SkeletonCard>
    )
  }

  const score      = data?.score ?? 0
  const components = data?.components ?? {}

  return (
    <CardShell title="Financial Health Score" interactive={false}>
      <div className="flex flex-col items-center gap-6 py-2">
        <Gauge score={score} />

        {Object.keys(components).length > 0 && (
          <div className="w-full space-y-2.5">
            {Object.entries(components).map(([key, val]) => {
              const pct = Math.round((val.score ?? 0) * 100)
              const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-gray-500 dark:text-gray-400">{label}</span>
                    <span className="text-[12px] font-semibold text-gray-700 dark:text-gray-200 tabular-nums">{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className="h-1.5 rounded-full bg-brand-500 transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </CardShell>
  )
}
