import React from 'react'
import { CreditCard, Calendar, FileText, ChevronDown, ChevronUp } from 'lucide-react'

function fmt(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

/**
 * Group files by account number and compute the merged date range per account.
 * Files without an account number are grouped under a null key.
 * Returns array ordered by earliest date_from across all files in each group,
 * preserving the upload order within groups.
 */
function groupByAccount(files) {
  const map = new Map()

  for (const f of files) {
    const key = f.account_number || null
    if (!map.has(key)) {
      map.set(key, { account_number: key, date_from: null, date_to: null, files: [] })
    }
    const group = map.get(key)
    group.files.push(f)

    if (f.date_from) {
      group.date_from = group.date_from
        ? (f.date_from < group.date_from ? f.date_from : group.date_from)
        : f.date_from
    }
    if (f.date_to) {
      group.date_to = group.date_to
        ? (f.date_to > group.date_to ? f.date_to : group.date_to)
        : f.date_to
    }
  }

  // Sort groups by earliest date_from so chronological order is consistent
  return [...map.values()].sort((a, b) => {
    if (!a.date_from) return 1
    if (!b.date_from) return -1
    return a.date_from < b.date_from ? -1 : 1
  })
}

function StatementBanner({ data }) {
  const [expanded, setExpanded] = React.useState(false)

  if (!data || (!data.date_from && !data.account_number && !data.files?.length)) return null

  const files      = data.files || []
  const multiFile  = files.length > 1
  const isAllFiles = files.length > 0   // more than one file uploaded total
  const groups     = isAllFiles ? groupByAccount(files) : []
  const totalTxns = files.reduce((s, f) => s + (f.row_count || 0), 0)

  return (
    <div className="card border-brand-200 dark:border-brand-800 bg-gradient-to-r from-brand-50 to-white dark:from-brand-950 dark:to-gray-900">
      <div className="px-5 py-3.5">

        {/* ── Main row ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3">

          {isAllFiles && groups.length > 0 ? (
            /* Multiple files: show each account group inline */
            groups.map((grp, i) => (
              <div key={i} className="flex items-start gap-2">
                <CreditCard size={15} className="text-brand-500 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-[0.06em]">
                    Account
                  </p>
                  <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 font-mono">
                    {grp.account_number ?? 'Unknown'}
                  </p>
                  {(grp.date_from || grp.date_to) && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                      <Calendar size={11} className="text-brand-400 shrink-0" aria-hidden="true" />
                      {fmt(grp.date_from)} to {fmt(grp.date_to)}
                    </p>
                  )}
                </div>
              </div>
            ))
          ) : (
            /* Single file: original layout */
            <>
              {data.account_number && (
                <div className="flex items-center gap-2">
                  <CreditCard size={15} className="text-brand-500 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-[0.06em]">Account</p>
                    <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 font-mono">{data.account_number}</p>
                  </div>
                </div>
              )}
              {(data.date_from || data.date_to) && (
                <div className="flex items-center gap-2">
                  <Calendar size={15} className="text-brand-500 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-[0.06em]">Period</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                      {fmt(data.date_from)} to {fmt(data.date_to)}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* File count pill */}
          {files.length > 0 && (
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-brand-500 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-[0.06em]">Source</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {files.length} file{files.length !== 1 ? 's' : ''}
                  {' '}·{' '}
                  {totalTxns.toLocaleString()} transactions
                </p>
              </div>
            </div>
          )}

          {/* Expand toggle - only if multiple files */}
          {multiFile && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="ml-auto flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium self-center"
              aria-expanded={expanded}
              aria-controls="statement-files-list"
            >
              {expanded ? 'Hide files' : 'View files'}
              {expanded
                ? <ChevronUp size={13} aria-hidden="true" />
                : <ChevronDown size={13} aria-hidden="true" />
              }
            </button>
          )}
        </div>

        {/* ── Expanded file list ─────────────────────────────────────────── */}
        {expanded && multiFile && (
          <div id="statement-files-list" className="mt-3 pt-3 border-t border-brand-100 dark:border-brand-900 space-y-1.5">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 gap-4">
                <span className="font-medium truncate max-w-[200px]" title={f.filename}>
                  {f.filename}
                </span>
                <span className="text-gray-400 dark:text-gray-500 shrink-0 flex items-center gap-3">
                  {f.account_number && (
                    <span className="font-mono">{f.account_number}</span>
                  )}
                  <span>{fmt(f.date_from)} to {fmt(f.date_to)} · {f.row_count} txns</span>
                </span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

export default StatementBanner
