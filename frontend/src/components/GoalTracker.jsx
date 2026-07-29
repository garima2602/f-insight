import React, { useState, useEffect } from 'react'
import { Target, Plus, Trash2, CheckCircle2 } from 'lucide-react'

const STORAGE_KEY = 'finsight_goals'

function loadGoals() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveGoals(goals) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goals))
}

function pct(current, target) {
  if (!target || target <= 0) return 0
  return Math.min(100, Math.round((current / target) * 100))
}

function ProgressBar({ value }) {
  const color = value >= 100
    ? 'bg-green-500'
    : value >= 60
    ? 'bg-brand-500'
    : value >= 30
    ? 'bg-amber-400'
    : 'bg-red-400'
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

export default function GoalTracker({ currentSavings = 0 }) {
  const [goals, setGoals]     = useState(loadGoals)
  const [adding, setAdding]   = useState(false)
  const [form, setForm]       = useState({ name: '', target: '', date: '' })
  const [error, setError]     = useState('')

  useEffect(() => saveGoals(goals), [goals])

  const handleAdd = () => {
    const target = parseFloat(form.target)
    if (!form.name.trim()) { setError('Enter a goal name.'); return }
    if (!target || target <= 0) { setError('Enter a valid target amount.'); return }
    setGoals(prev => [
      ...prev,
      {
        id:      Date.now(),
        name:    form.name.trim(),
        target,
        date:    form.date || null,
        saved:   0,
        created: new Date().toISOString(),
      },
    ])
    setForm({ name: '', target: '', date: '' })
    setError('')
    setAdding(false)
  }

  const handleDelete = (id) => setGoals(prev => prev.filter(g => g.id !== id))

  const handleSavedChange = (id, value) => {
    const n = parseFloat(value)
    if (isNaN(n) || n < 0) return
    setGoals(prev => prev.map(g => g.id === id ? { ...g, saved: n } : g))
  }

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target size={15} className="text-brand-500" />
          <h3 className="section-title">Savings Goals</h3>
        </div>
        <button
          onClick={() => { setAdding(v => !v); setError('') }}
          className="btn-ghost text-[12px] flex items-center gap-1 px-2 py-1"
          aria-label={adding ? 'Cancel' : 'Add goal'}
        >
          <Plus size={13} />
          {adding ? 'Cancel' : 'Add Goal'}
        </button>
      </div>

      <div className="card-body space-y-4">
        {adding && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2 bg-gray-50 dark:bg-gray-800/50">
            <input
              className="input text-sm w-full"
              placeholder="Goal name (e.g. Emergency Fund)"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
            <div className="flex gap-2">
              <input
                className="input text-sm flex-1"
                type="number"
                placeholder="Target ₹"
                min="1"
                value={form.target}
                onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
              />
              <input
                className="input text-sm flex-1"
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
            {error && <p className="text-[11px] text-red-500">{error}</p>}
            <button onClick={handleAdd} className="btn-primary text-sm w-full py-1.5">
              Save Goal
            </button>
          </div>
        )}

        {goals.length === 0 && !adding && (
          <div className="text-center py-6 text-gray-400 dark:text-gray-500">
            <Target size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-[13px]">No goals yet. Add your first savings goal.</p>
          </div>
        )}

        {goals.map(goal => {
          const progress = pct(goal.saved, goal.target)
          const done = progress >= 100
          const daysLeft = goal.date
            ? Math.ceil((new Date(goal.date) - Date.now()) / 86400000)
            : null

          return (
            <div key={goal.id} className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {done
                    ? <CheckCircle2 size={13} className="text-green-500 shrink-0" />
                    : <Target size={13} className="text-brand-400 shrink-0" />
                  }
                  <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200 truncate">
                    {goal.name}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(goal.id)}
                  className="text-gray-300 dark:text-gray-600 hover:text-red-400 transition-colors shrink-0"
                  aria-label={`Delete goal ${goal.name}`}
                >
                  <Trash2 size={12} />
                </button>
              </div>

              <ProgressBar value={progress} />

              <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <span>₹</span>
                  <input
                    className="w-20 bg-transparent border-b border-gray-200 dark:border-gray-700 text-[11px] focus:outline-none focus:border-brand-400 tabular-nums"
                    type="number"
                    min="0"
                    value={goal.saved}
                    onChange={e => handleSavedChange(goal.id, e.target.value)}
                    title="Current saved amount"
                  />
                  <span>/ ₹{goal.target.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={done ? 'text-green-500 font-semibold' : ''}>{progress}%</span>
                  {daysLeft !== null && !done && (
                    <span className={daysLeft < 0 ? 'text-red-400' : ''}>
                      {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
