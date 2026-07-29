import React, { useState, useMemo } from 'react'
import { Target, Pencil, X, Check } from 'lucide-react'
import { useBudget } from '../contexts/BudgetContext'

const CATEGORIES = [
  'Food', 'Travel', 'Shopping', 'Entertainment',
  'Bills', 'Investment', 'Health', 'Education', 'Subscriptions', 'Others',
]

const CAT_COLORS = {
  Food: 'bg-orange-500', Travel: 'bg-blue-500', Shopping: 'bg-pink-500',
  Entertainment: 'bg-purple-500', Bills: 'bg-red-500', Investment: 'bg-brand-500',
  Health: 'bg-teal-500', Education: 'bg-indigo-500',
  Subscriptions: 'bg-violet-500', Others: 'bg-gray-400',
}

function pct(spent, budget) {
  if (!budget) return 0
  return Math.min(100, Math.round((spent / budget) * 100))
}

function fmt(n) {
  return '₹' + (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function BudgetRow({ category, spent, budget, onEdit }) {
  const p        = pct(spent, budget)
  const over     = budget > 0 && spent > budget
  const barColor = over ? 'bg-red-500' : (CAT_COLORS[category] ?? 'bg-brand-500')
  const hasGoal  = budget > 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-gray-700 dark:text-gray-300 truncate">{category}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[12px] tabular-nums font-medium ${over ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}`}>
            {fmt(spent)}{hasGoal ? ` / ${fmt(budget)}` : ''}
          </span>
          {hasGoal && (
            <span className={`text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full
              ${over
                ? 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400'
                : p >= 80
                  ? 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
                  : 'bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400'}`}>
              {p}%
            </span>
          )}
          <button
            onClick={() => onEdit(category)}
            className="p-1 rounded text-gray-300 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-300
                       hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={`Edit ${category} budget`}
          >
            <Pencil size={11} />
          </button>
        </div>
      </div>
      {hasGoal ? (
        <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${p}%` }}
            role="progressbar"
            aria-valuenow={p}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${category}: ${p}% of budget used`}
          />
        </div>
      ) : (
        <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full" aria-hidden="true" />
      )}
    </div>
  )
}

function EditModal({ category, current, onSave, onClose }) {
  const [val, setVal] = useState(current > 0 ? String(current) : '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="card p-5 w-full max-w-xs space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="section-title">{category} Budget</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-1.5">
          <label className="stat-label">Monthly limit (₹)</label>
          <input
            type="number"
            min="0"
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSave(Number(val) || 0)}
            placeholder="0 = no limit"
            autoFocus
            className="input py-2"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1 py-2 text-sm">Cancel</button>
          <button
            onClick={() => onSave(Number(val) || 0)}
            className="btn-primary flex-1 py-2 text-sm"
          >
            <Check size={13} /> Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BudgetGoals({ spendingByCategory = {} }) {
  const { budgets, setBudget } = useBudget()
  const [editing, setEditing] = useState(null)

  const rows = useMemo(() =>
    CATEGORIES.map(cat => ({
      category: cat,
      spent:    spendingByCategory[cat] ?? 0,
      budget:   budgets[cat] ?? 0,
    })).filter(r => r.spent > 0 || r.budget > 0),
    [budgets, spendingByCategory]
  )

  const allRows = useMemo(() =>
    CATEGORIES.map(cat => ({
      category: cat,
      spent:    spendingByCategory[cat] ?? 0,
      budget:   budgets[cat] ?? 0,
    })),
    [budgets, spendingByCategory]
  )

  const hasAnySpending = Object.values(spendingByCategory).some(v => v > 0)
  const display = hasAnySpending ? (rows.length > 0 ? rows : allRows.slice(0, 5)) : allRows.slice(0, 5)

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target size={15} className="text-brand-500" aria-hidden="true" />
          <h3 className="section-title">Budget Goals</h3>
        </div>
        <button
          onClick={() => setEditing('__all__')}
          className="text-[11px] font-medium text-brand-600 dark:text-brand-400 hover:underline"
        >
          Edit all
        </button>
      </div>
      <div className="card-body space-y-4">
        {display.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Target size={24} className="text-gray-200 dark:text-gray-700" />
            <p className="text-[13px] font-medium text-gray-500">No budgets set yet</p>
            <p className="meta-text">Click a pencil icon or "Edit all" to add monthly limits.</p>
          </div>
        ) : (
          display.map(r => (
            <BudgetRow key={r.category} {...r} onEdit={setEditing} />
          ))
        )}
      </div>

      {editing && editing !== '__all__' && (
        <EditModal
          category={editing}
          current={budgets[editing] ?? 0}
          onSave={(amt) => { setBudget(editing, amt); setEditing(null) }}
          onClose={() => setEditing(null)}
        />
      )}

      {editing === '__all__' && (
        <BulkEditModal
          budgets={budgets}
          onSave={(bulk) => { Object.entries(bulk).forEach(([k, v]) => setBudget(k, v)); setEditing(null) }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function BulkEditModal({ budgets, onSave, onClose }) {
  const [vals, setVals] = useState(() =>
    Object.fromEntries(CATEGORIES.map(c => [c, budgets[c] > 0 ? String(budgets[c]) : '']))
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="card p-5 w-full max-w-sm space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="section-title">Monthly Budgets</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          {CATEGORIES.map(cat => (
            <div key={cat} className="flex items-center gap-3">
              <label className="text-[13px] font-medium text-gray-700 dark:text-gray-300 w-28 shrink-0">{cat}</label>
              <input
                type="number"
                min="0"
                value={vals[cat]}
                onChange={e => setVals(v => ({ ...v, [cat]: e.target.value }))}
                placeholder="0"
                className="input py-1.5 text-[12px] flex-1"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1 py-2 text-sm">Cancel</button>
          <button
            onClick={() => onSave(Object.fromEntries(CATEGORIES.map(c => [c, Number(vals[c]) || 0])))}
            className="btn-primary flex-1 py-2 text-sm"
          >
            <Check size={13} /> Save all
          </button>
        </div>
      </div>
    </div>
  )
}
