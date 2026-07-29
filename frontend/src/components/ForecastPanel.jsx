import React from 'react'
import { TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { CardShell, SkeletonCard } from './ui/CardShell'
import EmptyState from './ui/EmptyState'
import ChartTooltip from './ui/ChartTooltip'

const INCOME_COLOR  = '#16a34a'
const EXPENSE_COLOR = '#ef4444'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <ChartTooltip>
      <p className="stat-label mb-2">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="text-[12px]" style={{ color: p.color }}>
          {p.name}: ₹{Number(p.value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </p>
      ))}
    </ChartTooltip>
  )
}

export default function ForecastPanel({ data, loading }) {
  if (loading) {
    return (
      <SkeletonCard label="Loading forecast" headerWidth="w-36" stretch>
        <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded" />
      </SkeletonCard>
    )
  }

  const months = data?.forecast ?? []

  return (
    <CardShell title="3-Month Cash Flow Forecast" interactive={false} stretch flex>
      {months.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Not enough data"
          subtitle="Need at least 2 months of history to generate a forecast"
          className="py-8"
        />
      ) : (
        <div role="img" aria-label="3-month cash flow forecast bar chart">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={months} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                     tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar dataKey="income"   fill={INCOME_COLOR}  name="Income"   radius={[3, 3, 0, 0]} opacity={0.8} />
              <Bar dataKey="expenses" fill={EXPENSE_COLOR} name="Expenses" radius={[3, 3, 0, 0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </CardShell>
  )
}
