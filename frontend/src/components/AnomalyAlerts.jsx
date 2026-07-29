import React, { useMemo, useState } from 'react'
import { AlertTriangle, TrendingUp, Copy, ChevronDown, ChevronUp } from 'lucide-react'
import { CardShell, SkeletonCard } from './ui/CardShell'
import EmptyState from './ui/EmptyState'

function fmt(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function findDuplicates(transactions) {
  if (!transactions?.length) return []
  const dupes = []
  const seen  = new Map()

  for (const t of transactions) {
    const amount  = Math.round((t.debit || 0) + (t.credit || 0))
    const prefix  = (t.narration || t.merchant || '').slice(0, 12).toLowerCase().trim()
    const key     = `${amount}|${prefix}`

    if (seen.has(key)) {
      const orig    = seen.get(key)
      const dayDiff = Math.abs(new Date(t.date) - new Date(orig.date)) / 86400000
      if (dayDiff <= 3 && dayDiff >= 0) {
        dupes.push({ original: orig, duplicate: t, amount })
      }
    } else {
      seen.set(key, t)
    }
  }
  return dupes
}

function AnomalyCard({ a }) {
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50
                    border border-red-100 dark:border-red-900">
      <AlertTriangle size={14} className="text-red-500 dark:text-red-400 mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <p className="text-[13px] font-semibold text-red-800 dark:text-red-200 truncate">
            {a.merchant || a.narration || 'Unknown transaction'}
          </p>
          <span className="text-[13px] font-bold text-red-700 dark:text-red-300 tabular-nums shrink-0">
            {fmt(a.debit || a.credit || 0)}
          </span>
        </div>
        <p className="meta-text text-red-600 dark:text-red-400 mt-0.5">
          {a.date} · {a.category}
          {a.deviation_pct != null && ` · ${Math.round(a.deviation_pct)}% above category average`}
        </p>
        {a.reason && <p className="meta-text text-red-500 dark:text-red-500 mt-1">{a.reason}</p>}
      </div>
    </div>
  )
}

function DuplicateCard({ dupe }) {
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50
                    border border-amber-100 dark:border-amber-900">
      <Copy size={14} className="text-amber-500 dark:text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <p className="text-[13px] font-semibold text-amber-800 dark:text-amber-200 truncate">
            Possible duplicate: {dupe.original.merchant || dupe.original.narration || 'transaction'}
          </p>
          <span className="text-[13px] font-bold text-amber-700 dark:text-amber-300 tabular-nums shrink-0">
            {fmt(dupe.amount)}
          </span>
        </div>
        <p className="meta-text text-amber-600 dark:text-amber-400 mt-0.5">
          {dupe.original.date} and {dupe.duplicate.date} · same amount within 3 days
        </p>
        <p className="meta-text text-amber-500 dark:text-amber-500 mt-0.5">
          Check the Transactions tab and delete the duplicate if needed.
        </p>
      </div>
    </div>
  )
}

export default function AnomalyAlerts({ data, loading, transactions }) {
  const [showAll, setShowAll] = useState(false)

  const anomalies  = data?.anomalies ?? []
  const duplicates = useMemo(() => findDuplicates(transactions), [transactions])

  const totalAlerts = anomalies.length + duplicates.length

  if (loading) {
    return (
      <SkeletonCard label="Loading anomaly alerts" headerWidth="w-36">
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg" />
          ))}
        </div>
      </SkeletonCard>
    )
  }

  return (
    <CardShell
      title="Smart Alerts"
      interactive={false}
      action={
        totalAlerts > 0
          ? <span className="badge bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800">
              {totalAlerts}
            </span>
          : null
      }
    >
      {totalAlerts === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No anomalies detected"
          subtitle="Unusual spending patterns and duplicate transactions will appear here"
          className="py-8"
        />
      ) : (
        <div className="space-y-3">
          {/* Duplicates first — actionable */}
          {duplicates.map((d, i) => <DuplicateCard key={`dup-${i}`} dupe={d} />)}

          {/* Anomalies — show first 3, collapse rest */}
          {(showAll ? anomalies : anomalies.slice(0, 3)).map((a, i) => (
            <AnomalyCard key={`anom-${i}`} a={a} />
          ))}

          {anomalies.length > 3 && (
            <button
              onClick={() => setShowAll(v => !v)}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-[12px]
                         font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700
                         dark:hover:text-gray-200 transition-colors"
            >
              {showAll
                ? <><ChevronUp size={13} /> Show less</>
                : <><ChevronDown size={13} /> Show {anomalies.length - 3} more anomalies</>
              }
            </button>
          )}
        </div>
      )}
    </CardShell>
  )
}
