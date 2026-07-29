import React, { useId } from 'react'
import { Search, SlidersHorizontal, ChevronDown, X } from 'lucide-react'

function TransactionFilters({
  search, setSearch,
  typeFilter, setTypeFilter,
  minAmount, setMinAmount,
  maxAmount, setMaxAmount,
  hasActiveFilters, onClear,
}) {
  const searchId = useId()
  const typeId   = useId()
  const minId    = useId()
  const maxId    = useId()

  return (
    <div role="group" aria-label="Filter transactions" className="flex flex-wrap items-end gap-2">
      {/* Search */}
      <div className="flex flex-col gap-1">
        <label htmlFor={searchId} className="stat-label">Search</label>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true" />
          <input
            id={searchId}
            type="search"
            placeholder="Narration, merchant…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-7 pr-3 py-1.5 text-[12px] w-44 sm:w-52"
          />
        </div>
      </div>

      {/* Type */}
      <div className="flex flex-col gap-1">
        <label htmlFor={typeId} className="stat-label">Type</label>
        <div className="relative">
          <SlidersHorizontal size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true" />
          <select
            id={typeId}
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="input pl-7 pr-8 py-1.5 text-[12px] appearance-none cursor-pointer w-36"
          >
            <option value="all">All types</option>
            <option value="deposit">Deposits</option>
            <option value="withdrawal">Withdrawals</option>
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true" />
        </div>
      </div>

      {/* Amount range */}
      <div className="flex flex-col gap-1">
        <span className="stat-label">Amount range</span>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px] pointer-events-none">₹</span>
            <input
              id={minId}
              type="number"
              min="0"
              placeholder="Min"
              value={minAmount}
              onChange={e => setMinAmount(e.target.value)}
              aria-label="Minimum amount"
              className="input pl-6 pr-2 py-1.5 text-[12px] w-20 tabular-nums"
            />
          </div>
          <span className="text-gray-300 dark:text-gray-600 text-[11px]">–</span>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px] pointer-events-none">₹</span>
            <input
              id={maxId}
              type="number"
              min="0"
              placeholder="Max"
              value={maxAmount}
              onChange={e => setMaxAmount(e.target.value)}
              aria-label="Maximum amount"
              className="input pl-6 pr-2 py-1.5 text-[12px] w-20 tabular-nums"
            />
          </div>
        </div>
      </div>

      {hasActiveFilters && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium
                     text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors
                     border border-gray-200 self-end mb-px
                     dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 dark:border-gray-700"
          aria-label="Clear all filters"
        >
          <X size={11} aria-hidden="true" />
          Clear
        </button>
      )}
    </div>
  )
}

export default TransactionFilters
