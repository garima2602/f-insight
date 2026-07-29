import React, { useState } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'

const PRESETS = [
  { value: 'all',  label: 'All time' },
  { value: '30d',  label: 'Last 30 days' },
  { value: '3m',   label: 'Last 3 months' },
  { value: '6m',   label: 'Last 6 months' },
  { value: '12m',  label: 'Last 12 months' },
  { value: 'custom', label: 'Custom range' },
]

export default function DateRangeFilter({
  preset, onPresetChange,
  customRange, onCustomRangeChange,
}) {
  const [open, setOpen] = useState(false)
  const current = PRESETS.find(p => p.value === preset) ?? PRESETS[0]

  function selectPreset(value) {
    onPresetChange(value)
    if (value !== 'custom') setOpen(false)
  }

  return (
    <div className="relative" aria-label="Date range filter">
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[12px] font-medium
                   border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300
                   hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50
                   dark:hover:border-brand-700 dark:hover:text-brand-400 dark:hover:bg-brand-950
                   focus-visible:ring-2 focus-visible:ring-brand-500 transition-all"
      >
        <Calendar size={12} aria-hidden="true" />
        {current.label}
        <ChevronDown size={11} aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="listbox"
            aria-label="Date range presets"
            className="absolute right-0 top-full mt-1 z-20 w-48 bg-white dark:bg-gray-900
                       border border-gray-100 dark:border-gray-800 rounded-xl shadow-lg py-1 animate-fade-in"
          >
            {PRESETS.map(p => (
              <button
                key={p.value}
                role="option"
                aria-selected={p.value === preset}
                onClick={() => selectPreset(p.value)}
                className={`w-full text-left px-3 py-2 text-[12px] transition-colors
                  ${p.value === preset
                    ? 'text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-950 font-semibold'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
              >
                {p.label}
              </button>
            ))}

            {preset === 'custom' && (
              <div className="px-3 pt-2 pb-3 border-t border-gray-100 dark:border-gray-800 mt-1 space-y-2">
                <label className="block">
                  <span className="stat-label block mb-1">From</span>
                  <input
                    type="date"
                    value={customRange?.from ?? ''}
                    onChange={e => onCustomRangeChange({ ...customRange, from: e.target.value })}
                    className="input w-full text-[12px] py-1.5"
                  />
                </label>
                <label className="block">
                  <span className="stat-label block mb-1">To</span>
                  <input
                    type="date"
                    value={customRange?.to ?? ''}
                    onChange={e => onCustomRangeChange({ ...customRange, to: e.target.value })}
                    className="input w-full text-[12px] py-1.5"
                  />
                </label>
                <button
                  onClick={() => setOpen(false)}
                  className="btn-primary w-full text-[12px] py-1.5"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
