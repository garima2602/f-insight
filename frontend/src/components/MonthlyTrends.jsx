import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { BarChart2 } from 'lucide-react'
import { useIsDark } from '../hooks/useIsDark'
import { CardShell, SkeletonCard } from './ui/CardShell'
import ChartTooltip from './ui/ChartTooltip'
import EmptyState from './ui/EmptyState'

const SKELETON_HEIGHTS = [
  { income: 55, expense: 40 }, { income: 80, expense: 65 },
  { income: 45, expense: 70 }, { income: 70, expense: 50 },
  { income: 60, expense: 45 }, { income: 90, expense: 60 },
]

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <ChartTooltip className="min-w-[148px]">
      <p className="font-semibold text-gray-700 dark:text-gray-200 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 mt-1">
          <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: p.fill }} />
            {p.name}
          </span>
          <span className="font-semibold text-gray-800 dark:text-gray-100 tabular-nums">
            ₹{p.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
        </div>
      ))}
    </ChartTooltip>
  )
}

function MonthlyTrends({ data, loading }) {
  const isDark = useIsDark()

  if (loading) {
    return (
      <SkeletonCard stretch headerWidth="w-32" label="Loading monthly trends">
        <div className="flex items-end gap-2 h-52 pb-6 pt-2">
          {SKELETON_HEIGHTS.map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5">
              <div className="w-full flex gap-0.5 items-end" style={{ height: 160 }}>
                <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-t" style={{ height: `${h.income}%` }} />
                <div className="flex-1 bg-gray-100/70 dark:bg-gray-800/70 rounded-t" style={{ height: `${h.expense}%` }} />
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-5 mt-1" />
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-5 mt-1">
          {[40, 44].map((w, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-gray-100 dark:bg-gray-800 shrink-0" />
              <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded" style={{ width: w }} />
            </div>
          ))}
        </div>
      </SkeletonCard>
    )
  }

  const empty     = !data?.trends?.length
  const chartData = empty ? [] : data.trends.map(t => ({ ...t, month: t.month.slice(5) }))

  const gridStroke  = isDark ? '#1f2937' : '#f1f5f9'
  const tickFill    = isDark ? '#6b7280' : '#94a3b8'
  const cursorFill  = isDark ? '#1f2937' : '#f8fafc'
  const legendColor = isDark ? '#9ca3af' : '#374151'

  return (
    <CardShell title="Monthly Trends" stretch>
      {empty ? (
        <EmptyState
          icon={BarChart2}
          title="No monthly data yet"
          subtitle="Upload statements to see income vs expense trends"
          iconClass="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-gray-800"
          iconSize={24}
          className="h-64"
        />
      ) : (
        <div role="img" aria-label={`Bar chart: monthly income vs expenses over ${chartData.length} months`}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} barGap={4} barCategoryGap="28%">
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: tickFill }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: tickFill }}
              axisLine={false} tickLine={false}
              tickFormatter={v => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
              width={52}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: cursorFill, radius: 4 }} />
            <Legend
              iconType="circle" iconSize={8}
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              formatter={(value) => <span style={{ color: legendColor }}>{value}</span>}
            />
            <Bar dataKey="income"   name="Income"   fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
        </div>
      )}
    </CardShell>
  )
}

export default MonthlyTrends
