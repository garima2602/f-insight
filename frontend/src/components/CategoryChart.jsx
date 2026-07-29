import React from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { PieChart as PieIcon } from 'lucide-react'
import { useIsDark } from '../hooks/useIsDark'
import { CardShell, SkeletonCard } from './ui/CardShell'
import ChartTooltip from './ui/ChartTooltip'
import EmptyState from './ui/EmptyState'

const PALETTE = ['#16a34a', '#2563eb', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d']

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <ChartTooltip>
      <p className="font-semibold text-gray-900 dark:text-gray-100">{d.name}</p>
      <p className="text-gray-500 dark:text-gray-400 mt-1">
        ₹{d.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        <span className="ml-1.5 text-gray-500 dark:text-gray-400 font-medium">{d.percentage}%</span>
      </p>
    </ChartTooltip>
  )
}

function CategoryChart({ data, loading }) {
  const isDark = useIsDark()

  if (loading) {
    return (
      <SkeletonCard stretch headerWidth="w-40" label="Loading spending by category">
        <div className="flex flex-col items-center gap-5 py-3">
          <div className="relative w-44 h-44 shrink-0">
            <div className="w-44 h-44 rounded-full bg-gray-100 dark:bg-gray-800" />
            <div className="absolute inset-0 m-auto w-[88px] h-[88px] rounded-full bg-white dark:bg-gray-900" />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2.5 justify-center">
            {[72, 56, 64, 48, 68, 52].map((w, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-gray-100 dark:bg-gray-800 shrink-0" />
                <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded" style={{ width: w }} />
              </div>
            ))}
          </div>
        </div>
      </SkeletonCard>
    )
  }

  const empty = !data?.categories?.length

  return (
    <CardShell title="Spending by Category" stretch>
      {empty ? (
        <EmptyState
          icon={PieIcon}
          title="No spending data yet"
          subtitle="Upload a bank statement to see category breakdown"
          iconClass="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-gray-800"
          iconSize={24}
          className="h-64"
        />
      ) : (
        <div role="img" aria-label={`Pie chart: spending by category across ${data.categories.length} categories`}>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data.categories.slice(0, 8).map(c => ({
                name: c.category, value: c.amount, percentage: c.percentage,
              }))}
              cx="50%" cy="50%"
              innerRadius={55} outerRadius={95}
              paddingAngle={2}
              dataKey="value"
            >
              {data.categories.slice(0, 8).map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => {
                const item = data.categories.find(c => c.category === value)
                return (
                  <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {value}{' '}
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                      ({item?.percentage ?? 0}%)
                    </span>
                  </span>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        </div>
      )}
    </CardShell>
  )
}

export default CategoryChart
