import React, { useMemo, useState } from 'react'
import { CardShell, SkeletonCard } from './ui/CardShell'
import EmptyState from './ui/EmptyState'
import { CalendarDays, X } from 'lucide-react'

const DAYS   = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function intensity(amount, max) {
  if (!amount || !max) return 0
  return Math.min(1, amount / max)
}

function cellColor(lvl) {
  if (lvl === 0)   return 'bg-gray-100 dark:bg-gray-800'
  if (lvl < 0.25)  return 'bg-brand-100 dark:bg-brand-900'
  if (lvl < 0.5)   return 'bg-brand-200 dark:bg-brand-800'
  if (lvl < 0.75)  return 'bg-brand-400 dark:bg-brand-600'
  return                  'bg-brand-600 dark:bg-brand-400'
}

function fmt(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function DayDetail({ date, transactions, onClose }) {
  const dayTxns = useMemo(() =>
    (transactions || []).filter(t => t.date === date),
    [transactions, date]
  )
  const label = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const total = dayTxns.reduce((s, t) => s + (t.debit || 0), 0)

  return (
    <div className="mt-4 rounded-xl border border-brand-100 dark:border-brand-900 bg-brand-50/50 dark:bg-brand-950/30 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-100 dark:border-brand-900">
        <div>
          <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">{label}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            {dayTxns.length} transaction{dayTxns.length !== 1 ? 's' : ''} · {fmt(total)} spent
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close day detail"
          className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white dark:hover:bg-gray-800 transition-colors"
        >
          <X size={13} />
        </button>
      </div>
      {dayTxns.length === 0 ? (
        <p className="px-4 py-3 text-[12px] text-gray-500 dark:text-gray-400">No transactions found for this day.</p>
      ) : (
        <div className="divide-y divide-brand-100 dark:divide-brand-900 max-h-48 overflow-y-auto">
          {dayTxns.map((t, i) => (
            <div key={t.id ?? i} className="flex items-center justify-between px-4 py-2.5 gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-gray-700 dark:text-gray-200 truncate">{t.merchant || t.narration}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{t.category}</p>
              </div>
              <span className={`text-[12px] font-semibold tabular-nums shrink-0 ${
                t.transaction_type === 'deposit'
                  ? 'text-brand-600 dark:text-brand-400'
                  : 'text-red-500 dark:text-red-400'
              }`}>
                {t.transaction_type === 'deposit' ? '+' : '−'}{fmt(t.credit || t.debit || 0)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SpendingHeatmap({ data, loading, transactions }) {
  const [selectedDay, setSelectedDay] = useState(null)

  const cells   = data?.daily ?? {}
  const entries = Object.entries(cells)
  const hasData = entries.length > 0

  const maxAmount = hasData ? Math.max(...entries.map(([, v]) => v ?? 0)) : 0
  const dateMap   = hasData ? new Map(entries) : new Map()

  const dates     = hasData ? entries.map(([d]) => new Date(d + 'T00:00:00')).sort((a, b) => a - b) : []
  const startDate = dates[0] ?? null
  const endDate   = dates[dates.length - 1] ?? null

  const weeks = useMemo(() => {
    if (!startDate || !endDate) return []
    const gridStart = new Date(startDate)
    gridStart.setDate(gridStart.getDate() - gridStart.getDay())
    const result = []
    let current = new Date(gridStart)
    while (current <= endDate) {
      const week = []
      for (let d = 0; d < 7; d++) {
        const iso    = current.toISOString().split('T')[0]
        const amount = dateMap.get(iso) ?? 0
        week.push({ date: iso, amount, inRange: current >= startDate && current <= endDate })
        current = new Date(current)
        current.setDate(current.getDate() + 1)
      }
      result.push(week)
    }
    return result
  }, [hasData, data])

  const monthLabels = useMemo(() => {
    const labels = []
    weeks.forEach((week, wi) => {
      const first = week.find(c => c.inRange && new Date(c.date + 'T00:00:00').getDate() <= 7)
      if (first) {
        const m = new Date(first.date + 'T00:00:00').getMonth()
        if (!labels.length || labels[labels.length - 1].month !== m) {
          labels.push({ month: m, col: wi })
        }
      }
    })
    return labels
  }, [weeks])

  if (loading) {
    return (
      <SkeletonCard label="Loading spending heatmap" headerWidth="w-40">
        <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded" />
      </SkeletonCard>
    )
  }

  if (!hasData) {
    return (
      <CardShell title="Daily Spending Heatmap" interactive={false}>
        <EmptyState
          icon={CalendarDays}
          title="No data yet"
          subtitle="Daily spending calendar will appear once data is loaded"
          className="py-8"
        />
      </CardShell>
    )
  }

  function handleCellClick(cell) {
    if (!cell.inRange) return
    setSelectedDay(prev => prev === cell.date ? null : cell.date)
  }

  return (
    <CardShell title="Daily Spending Heatmap" interactive={false}
      action={<span className="meta-text text-gray-500 dark:text-gray-400">Click a day to see transactions</span>}
    >
      <div role="img" aria-label="Daily spending calendar heatmap" className="overflow-x-auto">
        <div className="min-w-0">
          {/* Month labels */}
          <div className="flex mb-1 pl-7" style={{ gap: '2px' }}>
            {weeks.map((_, wi) => {
              const lbl = monthLabels.find(l => l.col === wi)
              return (
                <div key={wi} className="w-3 shrink-0 text-[9px] text-gray-500 dark:text-gray-400 text-center">
                  {lbl ? MONTHS[lbl.month] : ''}
                </div>
              )
            })}
          </div>

          <div className="flex gap-1.5">
            {/* Day labels */}
            <div className="flex flex-col gap-0.5 mr-1 justify-around">
              {DAYS.map((d, i) => (
                <span key={i} className="text-[9px] text-gray-500 dark:text-gray-400 w-4 text-right leading-3">
                  {i % 2 === 1 ? d : ''}
                </span>
              ))}
            </div>

            {/* Grid */}
            <div className="flex gap-0.5">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-0.5">
                  {week.map((cell, di) => {
                    const lvl      = cell.inRange ? intensity(cell.amount, maxAmount) : 0
                    const selected = selectedDay === cell.date
                    return (
                      <button
                        key={di}
                        onClick={() => handleCellClick(cell)}
                        disabled={!cell.inRange}
                        title={cell.inRange
                          ? `${cell.date}: ${cell.amount ? fmt(cell.amount) + ' spent' : 'No spending'}`
                          : undefined}
                        aria-label={cell.inRange ? `${cell.date}: ${fmt(cell.amount)} spent` : undefined}
                        aria-pressed={selected}
                        className={`w-3 h-3 rounded-[2px] transition-all
                          ${cellColor(lvl)}
                          ${!cell.inRange ? 'opacity-0 cursor-default' : 'cursor-pointer hover:ring-1 hover:ring-brand-400'}
                          ${selected ? 'ring-2 ring-brand-500 dark:ring-brand-400 scale-110' : ''}
                        `}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-1 mt-3 justify-end" aria-hidden="true">
            <span className="text-[10px] text-gray-500 dark:text-gray-400 mr-1">Less</span>
            {[0, 0.2, 0.45, 0.7, 1].map((lvl, i) => (
              <div key={i} className={`w-3 h-3 rounded-[2px] ${cellColor(lvl)}`} />
            ))}
            <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-1">More</span>
          </div>
        </div>
      </div>

      {selectedDay && (
        <DayDetail
          date={selectedDay}
          transactions={transactions}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </CardShell>
  )
}
