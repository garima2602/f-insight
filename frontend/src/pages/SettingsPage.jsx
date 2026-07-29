import React, { useState, useEffect } from 'react'
import {
  Lock, ShieldCheck, ShieldOff, Eye, EyeOff, Check, AlertTriangle,
  Tag, Trash2, Plus, Download, RefreshCw, User2, BookOpen, UserCog,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useUserAuth } from '../contexts/UserAuthContext'
import { useMerchantRules } from '../contexts/MerchantRulesContext'
import PageHeader from '../components/PageHeader'
import {
  getAliases, createAlias, deleteAlias,
  getCategoryRules, createCategoryRule, deleteCategoryRule,
  getAccounts, renameAccount, downloadEncryptedBackup, importEncryptedBackup,
  getAllMerchantNames, updateProfile, changePassword,
} from '../api'

const ALL_CATEGORIES = [
  'Food','Travel','Shopping','Entertainment','Bills',
  'Subscriptions','Investment','Transfer','Health','Education','Tax','Others',
]

// ── Shared helpers ────────────────────────────────────────────────────────────

function PinField({ label, value, onChange, onEnter }) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <label className="stat-label">{label}</label>
      <div className="relative">
        <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type={show ? 'text' : 'password'}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={8}
          value={value}
          onChange={e => onChange(e.target.value.replace(/\D/g, ''))}
          onKeyDown={e => e.key === 'Enter' && onEnter?.()}
          placeholder="••••"
          className="input pl-9 pr-10 py-2 text-center tracking-[0.3em] font-mono"
          autoComplete="off"
        />
        <button type="button" onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          {show ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>
    </div>
  )
}

// ── PIN card subforms ─────────────────────────────────────────────────────────

function SetupForm({ onDone }) {
  const { setupPin } = useAuth()
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (pin.length < 4) { setError('PIN must be at least 4 digits.'); return }
    if (pin !== confirm) { setError('PINs do not match.'); return }
    setBusy(true)
    await setupPin(pin)
    setBusy(false)
    onDone()
  }

  return (
    <div className="space-y-4">
      <PinField label="New PIN (4–8 digits)" value={pin}     onChange={setPin}     onEnter={submit} />
      <PinField label="Confirm PIN"           value={confirm} onChange={setConfirm} onEnter={submit} />
      {error && <p className="text-[12px] text-red-500 font-medium">{error}</p>}
      <button onClick={submit} disabled={busy || !pin} className="btn-primary w-full py-2.5">
        {busy ? 'Saving…' : 'Enable PIN Lock'}
      </button>
    </div>
  )
}

function RemoveForm({ onDone }) {
  const { removePin, error, clearError } = useAuth()
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    clearError()
    setBusy(true)
    const ok = await removePin(pin)
    setBusy(false)
    if (ok) onDone()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900">
        <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[12px] text-amber-700 dark:text-amber-300">
          Removing PIN lock will leave your financial data unprotected.
        </p>
      </div>
      <PinField label="Current PIN" value={pin} onChange={setPin} onEnter={submit} />
      {error && <p className="text-[12px] text-red-500 font-medium">{error}</p>}
      <button onClick={submit} disabled={busy || !pin} className="btn-danger w-full py-2">
        {busy ? 'Checking…' : 'Remove PIN Lock'}
      </button>
    </div>
  )
}

// ── Tab: Security ─────────────────────────────────────────────────────────────

function SecurityTab() {
  const { pinHash } = useAuth()
  const { rules, removeRule } = useMerchantRules()
  const [mode, setMode] = useState(null)
  const [success, setSuccess] = useState('')
  const entries = Object.entries(rules)

  return (
    <div className="space-y-5">
      {/* PIN Lock */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Lock size={15} className="text-brand-500" />
          <h3 className="section-title">PIN Lock</h3>
        </div>
        <div className="card-body space-y-4">
          <div className="flex items-center gap-3">
            {pinHash
              ? <span className="flex items-center gap-1.5 text-[12px] font-medium text-brand-600 dark:text-brand-400"><ShieldCheck size={14} /> PIN lock is active</span>
              : <span className="flex items-center gap-1.5 text-[12px] font-medium text-gray-500"><ShieldOff size={14} /> No PIN set. Data is unprotected.</span>
            }
          </div>
          {success && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-brand-50 dark:bg-brand-950 border border-brand-200 dark:border-brand-900">
              <Check size={13} className="text-brand-600 dark:text-brand-400" />
              <p className="text-[12px] text-brand-700 dark:text-brand-300 font-medium">{success}</p>
            </div>
          )}
          {!mode && (
            <div className="flex gap-2">
              {!pinHash && <button onClick={() => { setSuccess(''); setMode('setup') }} className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5"><Lock size={13} /> Enable PIN Lock</button>}
              {pinHash && <>
                <button onClick={() => { setSuccess(''); setMode('setup') }} className="btn-secondary px-4 py-2 text-sm">Change PIN</button>
                <button onClick={() => { setSuccess(''); setMode('remove') }} className="btn-danger px-4 py-2">Remove PIN</button>
              </>}
            </div>
          )}
          {mode === 'setup' && <div className="space-y-3"><SetupForm onDone={() => { setMode(null); setSuccess('PIN lock enabled.') }} /><button onClick={() => setMode(null)} className="btn-ghost px-3 py-1.5 text-sm w-full">Cancel</button></div>}
          {mode === 'remove' && <div className="space-y-3"><RemoveForm onDone={() => { setMode(null); setSuccess('PIN lock removed.') }} /><button onClick={() => setMode(null)} className="btn-ghost px-3 py-1.5 text-sm w-full">Cancel</button></div>}
          <p className="meta-text">PIN is hashed locally and never transmitted. App auto-locks after 5 min in background.</p>
        </div>
      </div>

      {/* Auto-categorisation rules (localStorage-based) */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Tag size={15} className="text-brand-500" />
          <h3 className="section-title">Auto-Categorisation Rules</h3>
        </div>
        <div className="card-body">
          {entries.length === 0
            ? <p className="text-[12px] text-gray-500 dark:text-gray-400">No rules saved yet. Edit a transaction category and choose "Always use for [merchant]" to save a rule.</p>
            : <div className="space-y-1">{entries.map(([merchant, category]) => (
                <div key={merchant} className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-gray-800 dark:text-gray-100 truncate">{merchant}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">→ {category}</p>
                  </div>
                  <button onClick={() => removeRule(merchant)} aria-label={`Remove rule for ${merchant}`} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors shrink-0"><Trash2 size={12} /></button>
                </div>
              ))}</div>
          }
        </div>
      </div>
    </div>
  )
}

// ── Tab: Merchant Aliases ─────────────────────────────────────────────────────

function AliasesTab() {
  const [aliases, setAliases] = useState([])
  const [merchants, setMerchants] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ raw: '', alias: '' })
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)

  const load = async () => {
    try {
      const [d, m] = await Promise.all([getAliases(), getAllMerchantNames()])
      setAliases(d.aliases || [])
      setMerchants(m.merchants || [])
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!form.raw || !form.alias.trim()) { setError('Both fields are required.'); return }
    try {
      await createAlias(form.raw, form.alias.trim())
      setForm({ raw: '', alias: '' }); setError(''); setAdding(false)
      await load()
    } catch (e) { setError(e.message) }
  }

  const handleDelete = async (id) => {
    await deleteAlias(id)
    await load()
  }

  // merchants not yet aliased
  const aliasedRaws = new Set(aliases.map(a => a.raw_merchant))
  const available = merchants.filter(m => !aliasedRaws.has(m))

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div className="flex items-center gap-2"><Tag size={15} className="text-brand-500" /><h3 className="section-title">Merchant Aliases</h3></div>
        <button onClick={() => { setAdding(v => !v); setError('') }} className="btn-ghost text-[12px] flex items-center gap-1 px-2 py-1">
          <Plus size={13} />{adding ? 'Cancel' : 'Add Alias'}
        </button>
      </div>
      <div className="card-body space-y-3">
        <p className="meta-text">Map detected merchant names to friendly display names. Applied instantly to all existing transactions.</p>

        {adding && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2 bg-gray-50 dark:bg-gray-800/50">
            <div>
              <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1 block">Merchant (as detected)</label>
              <select
                className="input text-sm w-full"
                value={form.raw}
                onChange={e => setForm(f => ({ ...f, raw: e.target.value }))}
              >
                <option value="">Select a merchant…</option>
                {available.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1 block">Display name</label>
              <input className="input text-sm w-full" placeholder="e.g. Credit Card Payment" value={form.alias} onChange={e => setForm(f => ({ ...f, alias: e.target.value }))} />
            </div>
            {error && <p className="text-[11px] text-red-500">{error}</p>}
            <button onClick={handleAdd} className="btn-primary text-sm w-full py-1.5">Save Alias</button>
          </div>
        )}

        {loading
          ? <p className="text-[12px] text-gray-400">Loading…</p>
          : aliases.length === 0
          ? <p className="text-[12px] text-gray-500 dark:text-gray-400">No aliases configured yet.</p>
          : <div className="space-y-1">{aliases.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
                <div className="min-w-0">
                  <p className="text-[13px] font-mono text-gray-700 dark:text-gray-200 truncate">{a.raw_merchant}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">→ {a.alias}</p>
                </div>
                <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors shrink-0"><Trash2 size={12} /></button>
              </div>
            ))}</div>
        }
      </div>
    </div>
  )
}

// ── Tab: Category Rules ───────────────────────────────────────────────────────

function CategoryRulesTab() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ keyword: '', category: 'Food' })
  const [error, setError] = useState('')

  const load = async () => { try { const d = await getCategoryRules(); setRules(d.rules || []) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!form.keyword.trim()) { setError('Keyword is required.'); return }
    try {
      await createCategoryRule(form.keyword.trim(), form.category)
      setForm({ keyword: '', category: 'Food' }); setError(''); setAdding(false)
      await load()
    } catch (e) { setError(e.message) }
  }

  const handleDelete = async (id) => { await deleteCategoryRule(id); await load() }

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div className="flex items-center gap-2"><BookOpen size={15} className="text-brand-500" /><h3 className="section-title">Category Rules</h3></div>
        <button onClick={() => { setAdding(v => !v); setError('') }} className="btn-ghost text-[12px] flex items-center gap-1 px-2 py-1">
          <Plus size={13} />{adding ? 'Cancel' : 'Add Rule'}
        </button>
      </div>
      <div className="card-body space-y-3">
        <p className="meta-text">Custom keyword → category mappings. If a narration contains the keyword, it overrides the auto-detection engine.</p>

        {adding && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2 bg-gray-50 dark:bg-gray-800/50">
            <input className="input text-sm w-full" placeholder="Keyword in narration (e.g. salary)" value={form.keyword} onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))} />
            <select className="input text-sm w-full" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {error && <p className="text-[11px] text-red-500">{error}</p>}
            <button onClick={handleAdd} className="btn-primary text-sm w-full py-1.5">Save Rule</button>
          </div>
        )}

        {loading
          ? <p className="text-[12px] text-gray-400">Loading…</p>
          : rules.length === 0
          ? <p className="text-[12px] text-gray-500 dark:text-gray-400">No custom rules yet.</p>
          : <div className="space-y-1">{rules.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-gray-700 dark:text-gray-200 truncate">{r.keyword}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">→ {r.category}</p>
                </div>
                <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors shrink-0"><Trash2 size={12} /></button>
              </div>
            ))}</div>
        }
      </div>
    </div>
  )
}

// ── Tab: Accounts ─────────────────────────────────────────────────────────────

function AccountsTab() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [editName, setEditName] = useState('')

  const load = async () => { try { const d = await getAccounts(); setAccounts(d.accounts || []) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])

  const handleRename = async (id) => {
    if (!editName.trim()) return
    await renameAccount(id, editName.trim())
    setEditing(null); setEditName('')
    await load()
  }

  // Encrypted backup
  const [passphrase, setPassphrase] = useState('')
  const [backupBusy, setBackupBusy] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importPassphrase, setImportPassphrase] = useState('')
  const [importBusy, setImportBusy] = useState(false)
  const [importResult, setImportResult] = useState(null)

  const handleBackup = async () => {
    if (!passphrase.trim()) return
    setBackupBusy(true)
    try {
      const blob = await downloadEncryptedBackup(passphrase)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'finsight_backup.enc'; a.click()
      URL.revokeObjectURL(url)
      setPassphrase('')
    } catch (e) { alert('Export failed: ' + e.message) }
    finally { setBackupBusy(false) }
  }

  const handleImport = async () => {
    if (!importFile || !importPassphrase.trim()) return
    setImportBusy(true)
    setImportResult(null)
    try {
      const result = await importEncryptedBackup(importPassphrase, importFile)
      setImportResult({ ok: true, message: `Imported ${result.imported} transactions${result.skipped ? ` (${result.skipped} skipped)` : ''}.` })
      setImportFile(null)
      setImportPassphrase('')
    } catch (e) {
      setImportResult({ ok: false, message: e.message })
    } finally { setImportBusy(false) }
  }

  return (
    <div className="space-y-5">
      {/* Account list */}
      <div className="card">
        <div className="card-header flex items-center gap-2"><User2 size={15} className="text-brand-500" /><h3 className="section-title">Accounts</h3></div>
        <div className="card-body space-y-2">
          <p className="meta-text">Each uploaded file is treated as a separate account. Give them friendly names to filter transactions by account.</p>
          {loading
            ? <p className="text-[12px] text-gray-400">Loading…</p>
            : accounts.length === 0
            ? <p className="text-[12px] text-gray-500 dark:text-gray-400">No uploads yet.</p>
            : <div className="space-y-2">{accounts.map(a => (
                <div key={a.id} className="flex items-center gap-3 py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
                  <div className="flex-1 min-w-0">
                    {editing === a.id
                      ? <input autoFocus className="input text-sm py-1" value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleRename(a.id); if (e.key === 'Escape') setEditing(null) }} />
                      : <>
                          <p className="text-[13px] font-medium text-gray-800 dark:text-gray-100 truncate">{a.account_name}</p>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{a.filename} · {a.date_from} → {a.date_to}</p>
                        </>
                    }
                  </div>
                  {editing === a.id
                    ? <button onClick={() => handleRename(a.id)} className="btn-primary text-[12px] px-3 py-1">Save</button>
                    : <button onClick={() => { setEditing(a.id); setEditName(a.account_name) }} className="btn-ghost text-[12px] px-2 py-1">Rename</button>
                  }
                </div>
              ))}</div>
          }
        </div>
      </div>

      {/* Encrypted backup */}
      <div className="card">
        <div className="card-header flex items-center gap-2"><Download size={15} className="text-brand-500" /><h3 className="section-title">Encrypted Backup</h3></div>
        <div className="card-body space-y-4">
          {/* Export */}
          <div className="space-y-2">
            <p className="text-[12px] font-semibold text-gray-700 dark:text-gray-300">Export</p>
            <p className="meta-text">Save all transactions as an AES-256 encrypted file. Only you can restore it with the same passphrase.</p>
            <input className="input text-sm w-full" type="password" placeholder="Set a passphrase…" value={passphrase} onChange={e => setPassphrase(e.target.value)} />
            <button onClick={handleBackup} disabled={backupBusy || !passphrase.trim()} className="btn-primary text-sm py-2 flex items-center gap-2">
              {backupBusy ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
              {backupBusy ? 'Exporting…' : 'Download Encrypted Backup'}
            </button>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800" />

          {/* Import */}
          <div className="space-y-2">
            <p className="text-[12px] font-semibold text-gray-700 dark:text-gray-300">Restore from Backup</p>
            <p className="meta-text">Upload a .enc backup file and enter its passphrase to restore transactions.</p>
            <input className="input text-sm w-full" type="password" placeholder="Backup passphrase…" value={importPassphrase} onChange={e => setImportPassphrase(e.target.value)} />
            <input type="file" accept=".enc" onChange={e => setImportFile(e.target.files[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 dark:file:bg-brand-950 dark:file:text-brand-300 hover:file:bg-brand-100 dark:hover:file:bg-brand-900 cursor-pointer" />
            {importResult && (
              <p className={`text-[12px] font-medium ${importResult.ok ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                {importResult.message}
              </p>
            )}
            <button onClick={handleImport} disabled={importBusy || !importFile || !importPassphrase.trim()} className="btn-primary text-sm py-2 flex items-center gap-2">
              {importBusy ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} className="rotate-180" />}
              {importBusy ? 'Restoring…' : 'Restore Backup'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Settings page ────────────────────────────────────────────────────────

const TABS = [
  { id: 'profile',    label: 'Profile',           icon: UserCog },
  { id: 'security',   label: 'Security',          icon: Lock },
  { id: 'aliases',    label: 'Merchant Aliases',  icon: Tag },
  { id: 'rules',      label: 'Category Rules',    icon: BookOpen },
  { id: 'accounts',   label: 'Accounts & Backup', icon: User2 },
]

// ── Profile Tab ───────────────────────────────────────────────────────────────

function ProfileTab() {
  const { user, loginSuccess } = useUserAuth()
  const [displayName, setDisplayName] = useState(user?.display_name || '')
  const [nameStatus, setNameStatus] = useState(null)

  const [curPwd, setCurPwd]   = useState('')
  const [newPwd, setNewPwd]   = useState('')
  const [pwdStatus, setPwdStatus] = useState(null)

  async function handleUpdateName(e) {
    e.preventDefault()
    setNameStatus('saving')
    try {
      const data = await updateProfile(displayName)
      loginSuccess({ ...user, display_name: data.display_name })
      setNameStatus('saved')
      setTimeout(() => setNameStatus(null), 2000)
    } catch (err) {
      setNameStatus('error:' + err.message)
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setPwdStatus('saving')
    try {
      await changePassword(curPwd, newPwd)
      setCurPwd('')
      setNewPwd('')
      setPwdStatus('saved')
      setTimeout(() => setPwdStatus(null), 2000)
    } catch (err) {
      setPwdStatus('error:' + err.message)
    }
  }

  return (
    <div className="space-y-5">
      {/* Display name */}
      <div className="card p-5 space-y-4">
        <h3 className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">Display Name</h3>
        <form onSubmit={handleUpdateName} className="flex gap-2">
          <input
            className="input flex-1"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Your display name"
            maxLength={60}
          />
          <button
            type="submit"
            disabled={nameStatus === 'saving'}
            className="btn-primary px-4 py-2 text-[12px]"
          >
            {nameStatus === 'saving' ? 'Saving…' : nameStatus === 'saved' ? '✓ Saved' : 'Save'}
          </button>
        </form>
        {nameStatus?.startsWith('error:') && (
          <p className="text-[11px] text-red-500">{nameStatus.slice(6)}</p>
        )}
        <p className="text-[11px] text-gray-400">Username: <span className="font-mono">@{user?.username}</span> (cannot be changed)</p>
      </div>

      {/* Change password */}
      <div className="card p-5 space-y-4">
        <h3 className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">Change Password</h3>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label className="stat-label mb-1 block">Current password</label>
            <input
              type="password"
              className="input w-full"
              value={curPwd}
              onChange={e => setCurPwd(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div>
            <label className="stat-label mb-1 block">New password</label>
            <input
              type="password"
              className="input w-full"
              value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              minLength={6}
              autoComplete="new-password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={pwdStatus === 'saving'}
            className="btn-primary px-4 py-2 text-[12px]"
          >
            {pwdStatus === 'saving' ? 'Updating…' : pwdStatus === 'saved' ? '✓ Updated' : 'Update Password'}
          </button>
          {pwdStatus?.startsWith('error:') && (
            <p className="text-[11px] text-red-500">{pwdStatus.slice(6)}</p>
          )}
        </form>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [tab, setTab] = useState('profile')

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl">
      <PageHeader title="Settings" subtitle="Security, categorisation rules, and accounts" />

      {/* Tab nav */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors
              ${tab === id
                ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'profile'  && <ProfileTab />}
      {tab === 'security' && <SecurityTab />}
      {tab === 'aliases'  && <AliasesTab />}
      {tab === 'rules'    && <CategoryRulesTab />}
      {tab === 'accounts' && <AccountsTab />}
    </div>
  )
}
