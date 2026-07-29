import React from 'react'
import { Store } from 'lucide-react'
import { CardShell, SkeletonCard } from './ui/CardShell'
import EmptyState from './ui/EmptyState'

function MerchantList({ data, loading }) {
  if (loading) {
    return (
      <SkeletonCard stretch headerWidth="w-28" label="Loading top merchants">
        <ol className="space-y-3.5">
          {[140, 110, 160, 95, 130, 120].map((nameW, i) => (
            <li key={i} className="flex items-center gap-3">
              <div className="w-5 h-3 bg-gray-100 dark:bg-gray-800 rounded shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded" style={{ width: nameW }} />
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-16 shrink-0 ml-3" />
                </div>
                <div className="h-1 bg-gray-100 dark:bg-gray-800 rounded-full w-full" />
              </div>
            </li>
          ))}
        </ol>
      </SkeletonCard>
    )
  }

  const merchants = data?.merchants?.slice(0, 10) ?? []
  const maxAmount = merchants[0]?.amount || 1

  return (
    <CardShell title="Top Merchants" stretch>
      {merchants.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No merchants yet"
          subtitle="Upload a statement to see top spend"
          className="h-48"
        />
      ) : (
        <ol className="space-y-3.5" aria-label="Top merchants by spending">
          {merchants.map((m, i) => {
            const pct = Math.round((m.amount / maxAmount) * 100)
            return (
              <li key={i} className="flex items-center gap-3">
                <span
                  className={`w-5 text-center text-[11px] font-bold shrink-0 tabular-nums
                              ${i === 0 ? 'text-amber-500' : 'text-gray-300 dark:text-gray-600'}`}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] font-medium text-gray-700 dark:text-gray-300 truncate max-w-[160px]">
                      {m.name}
                    </span>
                    <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 shrink-0 ml-3 tabular-nums">
                      ₹{m.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div
                    className="h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
                    aria-label={`${m.name}: ${pct}% of top spend`}
                  >
                    <div className="h-full rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </CardShell>
  )
}

export default MerchantList
