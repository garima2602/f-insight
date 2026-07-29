import React from 'react'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { CardShell, SkeletonCard } from './ui/CardShell'
import EmptyState from './ui/EmptyState'

function freqLabel(freq) {
  if (!freq) return ''
  const f = freq.toLowerCase()
  if (f.includes('month')) return 'Monthly'
  if (f.includes('week'))  return 'Weekly'
  if (f.includes('annual') || f.includes('year')) return 'Annual'
  return freq
}

function fmt(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function SubscriptionTracker({ data, loading }) {
  if (loading) {
    return (
      <SkeletonCard label="Loading subscriptions" headerWidth="w-40">
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-32" />
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-16" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    )
  }

  const subs = data?.subscriptions ?? []

  return (
    <CardShell title="Subscription Tracker" interactive={false}>
      {subs.length === 0 ? (
        <EmptyState
          icon={RefreshCw}
          title="No recurring payments found"
          subtitle="Subscriptions detected automatically from your data"
          className="py-8"
        />
      ) : (
        <div className="space-y-0 divide-y divide-gray-50 dark:divide-gray-800 -mx-5 -mb-4">
          {subs.map((sub, i) => (
            <div key={i} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-gray-800/40 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-950 flex items-center justify-center shrink-0">
                  <RefreshCw size={13} className="text-violet-600 dark:text-violet-400" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 truncate">
                    {sub.merchant || 'Unknown'}
                  </p>
                  <p className="meta-text">{freqLabel(sub.frequency)}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 tabular-nums">
                  {fmt(sub.monthly_cost ?? sub.amount ?? 0)}
                </p>
                <p className="meta-text">/month</p>
              </div>
            </div>
          ))}
          {data?.total_monthly_cost > 0 && (
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-800/50">
              <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">Total monthly</p>
              <p className="text-[13px] font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                {fmt(data.total_monthly_cost)}
              </p>
            </div>
          )}
        </div>
      )}
    </CardShell>
  )
}
