import React, { useState, useMemo, useCallback } from 'react'
import { ArrowUpCircle, ArrowDownCircle, ArrowUpDown, Search, ChevronLeft, ChevronRight, Check, Trash2 } from 'lucide-react'
import TableSkeleton from './ui/TableSkeleton'
import TransactionFilters from './TransactionFilters'
import EmptyState from './ui/EmptyState'
import ExportButton from './ExportButton'
import { updateTransactionCategory, deleteTransaction } from '../api'
import { useMerchantRules } from '../contexts/MerchantRulesContext'

const PAGE_SIZE = 50

const ALL_CATEGORIES = [
  'Food', 'Travel', 'Shopping', 'Entertainment', 'Bills',
  'Investment', 'Health', 'Education', 'Transfer', 'Subscriptions', 'Others',
]

const CATEGORY_COLORS = {
  Food:          'bg-orange-50 text-orange-700 ring-orange-200/60 dark:bg-orange-950 dark:text-orange-300 dark:ring-orange-800/60',
  Travel:        'bg-blue-50 text-blue-700 ring-blue-200/60 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-800/60',
  Shopping:      'bg-pink-50 text-pink-700 ring-pink-200/60 dark:bg-pink-950 dark:text-pink-300 dark:ring-pink-800/60',
  Entertainment: 'bg-purple-50 text-purple-700 ring-purple-200/60 dark:bg-purple-950 dark:text-purple-300 dark:ring-purple-800/60',
  Bills:         'bg-red-50 text-red-700 ring-red-200/60 dark:bg-red-950 dark:text-red-300 dark:ring-red-800/60',
  Investment:    'bg-brand-50 text-brand-700 ring-brand-200/60 dark:bg-brand-950 dark:text-brand-300 dark:ring-brand-800/60',
  Health:        'bg-teal-50 text-teal-700 ring-teal-200/60 dark:bg-teal-950 dark:text-teal-300 dark:ring-teal-800/60',
  Education:     'bg-indigo-50 text-indigo-700 ring-indigo-200/60 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-800/60',
  Transfer:      'bg-gray-100 text-gray-600 ring-gray-200/60 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700/60',
  Subscriptions: 'bg-violet-50 text-violet-700 ring-violet-200/60 dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-800/60',
  Others:        'bg-gray-100 text-gray-500 ring-gray-200/60 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700/60',
}

function categoryClass(cat) {
  return CATEGORY_COLORS[cat] ?? 'bg-gray-100 text-gray-500 ring-gray-200/60 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700/60'
}

// Inline category editor — click badge to edit, with optional merchant rule saving
function CategoryCell({ txn, displayCategory, onCategoryChange }) {
  const [editing,  setEditing]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [current,  setCurrent]  = useState(displayCategory ?? txn.category)
  const [rulePrompt, setRulePrompt] = useState(null) // { merchant, newCat }
  const { saveRule, getCategory, removeRule } = useMerchantRules()
  const ruleActive = txn.merchant ? getCategory(txn.merchant) !== null : false

  // Keep display in sync if parent overrides change
  React.useEffect(() => {
    setCurrent(displayCategory ?? txn.category)
  }, [displayCategory, txn.category])

  const apply = useCallback(async (newCat) => {
    if (newCat === current) { setEditing(false); return }
    const prev = current
    setCurrent(newCat) // optimistic update
    setSaving(true)
    try {
      await updateTransactionCategory(txn.id, newCat)
      onCategoryChange?.(txn.id, newCat)
      if (txn.merchant && txn.merchant.length <= 100) setRulePrompt({ merchant: txn.merchant, newCat })
    } catch {
      setCurrent(prev) // rollback on failure
    }
    finally { setSaving(false); setEditing(false) }
  }, [current, txn.id, txn.merchant, onCategoryChange])

  return (
    <div className="flex flex-col gap-1">
      {!editing ? (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setEditing(true)}
            title="Click to change category"
            className={`badge ring-1 cursor-pointer hover:opacity-80 transition-opacity ${categoryClass(current)}`}
          >
            {saving ? '…' : current}
          </button>
          {ruleActive && (
            <button
              onClick={() => { removeRule(txn.merchant); onCategoryChange?.(txn.id, txn.category) }}
              title="Remove auto-categorisation rule"
              className="text-[9px] text-brand-400 hover:text-red-400 transition-colors"
              aria-label="Remove saved rule"
            >★</button>
          )}
        </div>
      ) : (
        <select
          autoFocus
          value={current}
          onChange={e => apply(e.target.value)}
          onBlur={() => setEditing(false)}
          className="text-[11px] border border-brand-300 dark:border-brand-700 rounded-md bg-white dark:bg-gray-900
                     text-gray-800 dark:text-gray-100 py-0.5 px-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
          aria-label="Choose category"
        >
          {ALL_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      )}

      {rulePrompt && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-gray-500 dark:text-gray-400">Always use for</span>
          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300 truncate max-w-[100px]">{rulePrompt.merchant}?</span>
          <button
            onClick={() => { saveRule(rulePrompt.merchant, rulePrompt.newCat); setRulePrompt(null) }}
            className="text-[10px] text-brand-600 dark:text-brand-400 font-semibold hover:underline"
          >Yes</button>
          <button
            onClick={() => setRulePrompt(null)}
            className="text-[10px] text-gray-500 hover:text-gray-700"
          >No</button>
        </div>
      )}
    </div>
  )
}

function TransactionTable({ transactions, loading }) {
  if (loading) return <TableSkeleton />

  const [search,     setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [catFilter,  setCatFilter]  = useState('all')
  const [minAmount,  setMinAmount]  = useState('')
  const [maxAmount,  setMaxAmount]  = useState('')
  const [sortKey,    setSortKey]    = useState('date')
  const [sortDir,    setSortDir]    = useState('desc')
  const [page,       setPage]       = useState(1)
  // local overrides from inline edits
  const [catOverrides, setCatOverrides] = useState({})
  const [deletedIds,   setDeletedIds]   = useState(new Set())
  const [confirmDelete, setConfirmDelete] = useState(null)
  const { getCategory } = useMerchantRules()

  const handleCategoryChange = useCallback((id, cat) => {
    setCatOverrides(prev => ({ ...prev, [id]: cat }))
  }, [])

  const handleDelete = useCallback(async (id) => {
    if (confirmDelete !== id) { setConfirmDelete(id); return }
    try {
      await deleteTransaction(id)
      setDeletedIds(prev => new Set([...prev, id]))
    } catch { /* ignore */ }
    setConfirmDelete(null)
  }, [confirmDelete])

  const txnsWithOverrides = useMemo(() =>
    transactions
      .filter(t => !deletedIds.has(t.id))
      .map(t => {
        if (catOverrides[t.id]) return { ...t, category: catOverrides[t.id], _overridden: true }
        const ruleCategory = t.merchant ? getCategory(t.merchant) : null
        if (ruleCategory) return { ...t, category: ruleCategory, _ruleApplied: true }
        return t
      }),
    [transactions, catOverrides, deletedIds, getCategory]
  )

  const filtered = useMemo(() => {
    const q   = search.toLowerCase()
    const min = minAmount !== '' ? Number(minAmount) : null
    const max = maxAmount !== '' ? Number(maxAmount) : null
    let rows = txnsWithOverrides.filter(t => {
      const matchText = !q ||
        t.narration?.toLowerCase().includes(q) ||
        t.merchant?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q)
      const matchType = typeFilter === 'all' || t.transaction_type === typeFilter
      const matchCat  = catFilter  === 'all' || t.category === catFilter
      const amount    = (t.debit || 0) + (t.credit || 0)
      const matchMin  = min === null || amount >= min
      const matchMax  = max === null || amount <= max
      return matchText && matchType && matchCat && matchMin && matchMax
    })
    return [...rows].sort((a, b) => {
      let av, bv
      if      (sortKey === 'date')   { av = a.date ?? '';    bv = b.date ?? '' }
      else if (sortKey === 'amount') { av = (a.credit || 0) + (a.debit || 0); bv = (b.credit || 0) + (b.debit || 0) }
      else                           { av = (a[sortKey] ?? '').toString().toLowerCase(); bv = (b[sortKey] ?? '').toString().toLowerCase() }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ?  1 : -1
      return 0
    })
  }, [txnsWithOverrides, search, typeFilter, catFilter, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const visible    = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const hasActiveFilters = search !== '' || typeFilter !== 'all' || catFilter !== 'all' || minAmount !== '' || maxAmount !== ''

  function clearFilters() { setSearch(''); setTypeFilter('all'); setCatFilter('all'); setMinAmount(''); setMaxAmount(''); setPage(1) }
  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
    setPage(1)
  }
  function handleSearch(v) { setSearch(v); setPage(1) }
  function handleType(v)   { setTypeFilter(v); setPage(1) }
  function handleCat(v)    { setCatFilter(v); setPage(1) }

  function SortIcon({ col }) {
    if (sortKey !== col) return <ArrowUpDown size={10} className="text-gray-300 dark:text-gray-600 ml-1 inline" />
    return <span className="ml-1 inline text-brand-500 dark:text-brand-400 text-[10px]">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="card flex flex-col">
      <div className="card-header flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="section-title">Transactions</h3>
            <p className="meta-text mt-0.5">{filtered.length} of {transactions.length} shown</p>
          </div>
          <ExportButton transactions={filtered} />
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-wrap">
          <TransactionFilters
            search={search} setSearch={handleSearch}
            typeFilter={typeFilter} setTypeFilter={handleType}
            minAmount={minAmount} setMinAmount={v => { setMinAmount(v); setPage(1) }}
            maxAmount={maxAmount} setMaxAmount={v => { setMaxAmount(v); setPage(1) }}
            hasActiveFilters={hasActiveFilters} onClear={clearFilters}
          />
          {/* Category filter */}
          <div className="flex flex-col gap-1">
            <label className="stat-label">Category</label>
            <select
              value={catFilter}
              onChange={e => handleCat(e.target.value)}
              aria-label="Filter by category"
              className="input text-[12px] py-1.5 pr-7 min-w-[130px]"
            >
              <option value="all">All categories</option>
              {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {transactions.length === 0 && (
        <EmptyState
          icon={Search}
          title="No transactions yet"
          subtitle="Upload a bank statement to get started"
          className="flex-1 py-16 px-5"
        />
      )}

      {transactions.length > 0 && filtered.length === 0 && (
        <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-2 py-12">
          <p className="text-[13px] font-medium text-gray-500">No matching transactions</p>
          <p className="meta-text">Try adjusting your search or filter</p>
        </div>
      )}

      {visible.length > 0 && (
        <div className="overflow-x-auto">
          <div className="max-h-[560px] overflow-y-auto">
            <table className="w-full" aria-label="Transaction history">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800
                               shadow-[0_1px_0_0_#f1f5f9] dark:shadow-[0_1px_0_0_#1f2937]">
                  <th scope="col" onClick={() => toggleSort('date')}
                      aria-sort={sortKey === 'date' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className="text-left px-5 py-3 stat-label whitespace-nowrap cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                    Date <SortIcon col="date" />
                  </th>
                  <th scope="col" className="text-left px-4 py-3 stat-label">Narration</th>
                  <th scope="col" className="text-left px-4 py-3 stat-label hidden sm:table-cell">Merchant</th>
                  <th scope="col" className="text-left px-4 py-3 stat-label hidden md:table-cell">
                    Category <span className="normal-case font-normal text-gray-300 dark:text-gray-600">(click to edit)</span>
                  </th>
                  <th scope="col" onClick={() => toggleSort('amount')}
                      aria-sort={sortKey === 'amount' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className="text-right px-5 py-3 stat-label whitespace-nowrap cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                    Amount <SortIcon col="amount" />
                  </th>
                  <th scope="col" className="px-3 py-3 w-10" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {visible.map((t, i) => (
                  <tr key={t.id ?? i}
                      className="border-b border-gray-50 dark:border-gray-800/60 last:border-0
                                 hover:bg-slate-50 dark:hover:bg-gray-800/40 transition-colors duration-100 group">
                    <td className="px-5 py-3 text-[12px] text-gray-500 whitespace-nowrap font-mono tabular-nums">{t.date}</td>
                    <td className="px-4 py-3 max-w-[200px] sm:max-w-[240px]">
                      <span className="truncate block text-[13px] text-gray-700 dark:text-gray-300
                                       group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors"
                            title={t.narration}>
                        {t.narration}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[130px] hidden sm:table-cell">
                      <span className="truncate block text-[13px] text-gray-500 dark:text-gray-400" title={t.merchant}>
                        {t.merchant || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <CategoryCell txn={t} displayCategory={t.category} onCategoryChange={handleCategoryChange} />
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {t.transaction_type === 'deposit' ? (
                        <span className="inline-flex items-center justify-end gap-1 text-brand-600 dark:text-brand-400 font-semibold text-[13px] tabular-nums">
                          <ArrowUpCircle size={12} aria-hidden="true" />
                          +₹{(t.credit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-end gap-1 text-red-500 dark:text-red-400 font-semibold text-[13px] tabular-nums">
                          <ArrowDownCircle size={12} aria-hidden="true" />
                          −₹{(t.debit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => handleDelete(t.id)}
                        onBlur={() => { if (confirmDelete === t.id) setConfirmDelete(null) }}
                        aria-label={confirmDelete === t.id ? 'Confirm delete' : 'Delete transaction'}
                        title={confirmDelete === t.id ? 'Click again to confirm' : 'Delete'}
                        className={`p-1 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100
                          ${confirmDelete === t.id
                            ? 'text-red-600 bg-red-50 dark:bg-red-950'
                            : 'text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400'}`}
                      >
                        <Trash2 size={12} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-5 py-3 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between gap-4">
          <p className="meta-text">
            Page {safePage} of {totalPages} · {filtered.length} transactions
          </p>
          <div className="flex items-center gap-1" role="navigation" aria-label="Pagination">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              aria-label="Previous page"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                         disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let p = i + 1
              if (totalPages > 7) {
                const start = Math.max(1, Math.min(safePage - 3, totalPages - 6))
                p = start + i
              }
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  aria-label={`Page ${p}`}
                  aria-current={p === safePage ? 'page' : undefined}
                  className={`w-7 h-7 rounded-lg text-[12px] font-medium transition-colors
                    ${p === safePage
                      ? 'bg-brand-600 text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                >
                  {p}
                </button>
              )
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              aria-label="Next page"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                         disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default TransactionTable
