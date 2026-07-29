import React, { useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { CardShell } from './ui/CardShell'

const STORAGE_KEY = 'finsight_networth_accounts'

const ACCOUNT_TYPES = [
  { value: 'savings',    label: 'Savings Account', asset: true  },
  { value: 'current',    label: 'Current Account',  asset: true  },
  { value: 'fd',         label: 'Fixed Deposit',    asset: true  },
  { value: 'mutual',     label: 'Mutual Funds',     asset: true  },
  { value: 'stocks',     label: 'Stocks / Equity',  asset: true  },
  { value: 'ppf',        label: 'PPF / PF',         asset: true  },
  { value: 'property',   label: 'Property / Real Estate', asset: true },
  { value: 'other_asset',label: 'Other Asset',      asset: true  },
  { value: 'home_loan',  label: 'Home Loan',        asset: false },
  { value: 'personal',   label: 'Personal Loan',    asset: false },
  { value: 'car_loan',   label: 'Car Loan',         asset: false },
  { value: 'credit_card',label: 'Credit Card Due',  asset: false },
  { value: 'other_liab', label: 'Other Liability',  asset: false },
]

function loadAccounts() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}

function saveAccounts(accs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accs))
}

function fmt(n, showSign = false) {
  const abs = Math.abs(n)
  const str = '₹' + abs.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  if (!showSign) return str
  return (n < 0 ? '−' : '+') + str
}

function AccountRow({ acc, onEdit, onDelete }) {
  const typeInfo = ACCOUNT_TYPES.find(t => t.value === acc.type) ?? { label: acc.type, asset: true }
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 dark:border-gray-800/60 last:border-0 group">
      <div className={`w-1.5 h-8 rounded-full shrink-0 ${typeInfo.asset ? 'bg-brand-400' : 'bg-red-400'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-gray-800 dark:text-gray-100 leading-tight truncate">{acc.name}</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">{typeInfo.label}</p>
      </div>
      <span className={`text-[13px] font-semibold tabular-nums ${
        typeInfo.asset ? 'text-brand-600 dark:text-brand-400' : 'text-red-500 dark:text-red-400'
      }`}>
        {typeInfo.asset ? '' : '−'}{fmt(acc.balance)}
      </span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
        <button onClick={() => onEdit(acc)} aria-label="Edit account"
          className="p-1 rounded text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
          <Pencil size={11} />
        </button>
        <button onClick={() => onDelete(acc.id)} aria-label="Delete account"
          className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors">
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}

function AccountForm({ initial, onSave, onCancel }) {
  const [name,    setName]    = useState(initial?.name    ?? '')
  const [type,    setType]    = useState(initial?.type    ?? 'savings')
  const [balance, setBalance] = useState(initial?.balance != null ? String(initial.balance) : '')

  function handleSubmit(e) {
    e.preventDefault()
    const b = parseFloat(balance.replace(/,/g, ''))
    if (!name.trim() || isNaN(b)) return
    onSave({ name: name.trim(), type, balance: b })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="stat-label">Account name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. HDFC Savings"
            required
            className="input text-[12px] py-1.5"
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="stat-label">Type</label>
          <select value={type} onChange={e => setType(e.target.value)} className="input text-[12px] py-1.5">
            <optgroup label="Assets">
              {ACCOUNT_TYPES.filter(t => t.asset).map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </optgroup>
            <optgroup label="Liabilities">
              {ACCOUNT_TYPES.filter(t => !t.asset).map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="stat-label">Current balance (₹)</label>
        <input
          value={balance}
          onChange={e => setBalance(e.target.value)}
          placeholder="0"
          required
          inputMode="decimal"
          className="input text-[12px] py-1.5"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel}
          className="px-3 py-1.5 text-[12px] font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
          Cancel
        </button>
        <button type="submit"
          className="btn-primary px-4 py-1.5 text-[12px]">
          Save
        </button>
      </div>
    </form>
  )
}

export default function NetWorthTracker() {
  const [accounts, setAccounts] = useState(loadAccounts)
  const [adding,   setAdding]   = useState(false)
  const [editing,  setEditing]  = useState(null) // account object being edited

  const assets      = accounts.filter(a => (ACCOUNT_TYPES.find(t => t.value === a.type) ?? { asset: true }).asset)
  const liabilities = accounts.filter(a => !(ACCOUNT_TYPES.find(t => t.value === a.type) ?? { asset: true }).asset)
  const totalAssets      = assets.reduce((s, a) => s + a.balance, 0)
  const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0)
  const netWorth         = totalAssets - totalLiabilities

  const persist = useCallback((next) => {
    setAccounts(next)
    saveAccounts(next)
  }, [])

  const handleAdd = useCallback((data) => {
    persist([...accounts, { ...data, id: Date.now().toString() }])
    setAdding(false)
  }, [accounts, persist])

  const handleEdit = useCallback((data) => {
    persist(accounts.map(a => a.id === editing.id ? { ...a, ...data } : a))
    setEditing(null)
  }, [accounts, editing, persist])

  const handleDelete = useCallback((id) => {
    persist(accounts.filter(a => a.id !== id))
  }, [accounts, persist])

  return (
    <CardShell title="Net Worth" interactive={false}
      action={
        <button
          onClick={() => { setAdding(true); setEditing(null) }}
          className="flex items-center gap-1 text-[11px] font-medium text-brand-600 dark:text-brand-400
                     hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
          aria-label="Add account"
        >
          <Plus size={12} /> Add account
        </button>
      }
    >
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="flex flex-col gap-0.5">
          <span className="stat-label">Total Assets</span>
          <span className="text-[15px] font-bold text-brand-600 dark:text-brand-400 tabular-nums">{fmt(totalAssets)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="stat-label">Liabilities</span>
          <span className="text-[15px] font-bold text-red-500 dark:text-red-400 tabular-nums">{fmt(totalLiabilities)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="stat-label">Net Worth</span>
          <span className={`text-[15px] font-bold tabular-nums flex items-center gap-1 ${
            netWorth >= 0 ? 'text-gray-900 dark:text-gray-100' : 'text-red-500 dark:text-red-400'
          }`}>
            {netWorth >= 0
              ? <TrendingUp size={13} className="text-brand-500 shrink-0" />
              : <TrendingDown size={13} className="text-red-500 shrink-0" />
            }
            {netWorth < 0 ? '−' : ''}{fmt(Math.abs(netWorth))}
          </span>
        </div>
      </div>

      {/* Add / Edit form */}
      {adding && (
        <div className="mb-4">
          <AccountForm onSave={handleAdd} onCancel={() => setAdding(false)} />
        </div>
      )}
      {editing && (
        <div className="mb-4">
          <AccountForm initial={editing} onSave={handleEdit} onCancel={() => setEditing(null)} />
        </div>
      )}

      {accounts.length === 0 && !adding ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Wallet size={18} className="text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400">No accounts added yet</p>
          <p className="meta-text">Add your savings, investments, and loans to track net worth</p>
          <button
            onClick={() => setAdding(true)}
            className="mt-2 btn-primary px-4 py-2 text-[12px]"
          >
            Add first account
          </button>
        </div>
      ) : (
        <>
          {assets.length > 0 && (
            <div className="mb-4">
              <p className="stat-label mb-2">Assets</p>
              {assets.map(a => (
                <AccountRow key={a.id} acc={a}
                  onEdit={acc => { setEditing(acc); setAdding(false) }}
                  onDelete={handleDelete}
                />
              ))}
              <div className="flex justify-between pt-2 mt-1 border-t border-gray-100 dark:border-gray-800">
                <span className="text-[11px] text-gray-500 dark:text-gray-400">Total assets</span>
                <span className="text-[12px] font-semibold text-brand-600 dark:text-brand-400 tabular-nums">{fmt(totalAssets)}</span>
              </div>
            </div>
          )}

          {liabilities.length > 0 && (
            <div>
              <p className="stat-label mb-2">Liabilities</p>
              {liabilities.map(a => (
                <AccountRow key={a.id} acc={a}
                  onEdit={acc => { setEditing(acc); setAdding(false) }}
                  onDelete={handleDelete}
                />
              ))}
              <div className="flex justify-between pt-2 mt-1 border-t border-gray-100 dark:border-gray-800">
                <span className="text-[11px] text-gray-500 dark:text-gray-400">Total liabilities</span>
                <span className="text-[12px] font-semibold text-red-500 dark:text-red-400 tabular-nums">{fmt(totalLiabilities)}</span>
              </div>
            </div>
          )}
        </>
      )}
    </CardShell>
  )
}
