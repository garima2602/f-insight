import React, { useState, useRef, useEffect } from 'react'
import { Lock, Eye, EyeOff, Shield, TrendingUp } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

function PinInput({ value, onChange, onSubmit, placeholder = '••••', label }) {
  const [show, setShow] = useState(false)
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])

  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="stat-label text-center">{label}</label>}
      <div className="relative">
        <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true" />
        <input
          ref={ref}
          type={show ? 'text' : 'password'}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={8}
          value={value}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value.replace(/\D/g, ''))}
          onKeyDown={e => e.key === 'Enter' && onSubmit()}
          className="input pl-9 pr-10 py-2.5 text-center text-lg tracking-[0.4em] font-mono w-full"
          aria-label={label || 'PIN'}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label={show ? 'Hide PIN' : 'Show PIN'}
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  )
}

export default function LockScreen() {
  const { pinHash, locked, error, setupPin, unlock, clearError } = useAuth()
  const isSetup = !pinHash

  const [pin,     setPin]     = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy,    setBusy]    = useState(false)
  const [localErr, setLocalErr] = useState('')

  useEffect(() => { clearError() }, [])

  async function handleSubmit() {
    setLocalErr('')
    if (!pin || pin.length < 4) { setLocalErr('PIN must be at least 4 digits.'); return }
    if (isSetup) {
      if (pin !== confirm) { setLocalErr('PINs do not match.'); return }
      setBusy(true)
      await setupPin(pin)
      setBusy(false)
    } else {
      setBusy(true)
      await unlock(pin)
      setBusy(false)
    }
    setPin('')
    setConfirm('')
  }

  const displayError = localErr || error

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center shadow-lg">
            <TrendingUp size={24} className="text-white" aria-hidden="true" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50 tracking-tight">F-Insight</h1>
            <p className="meta-text mt-0.5">Financial Intelligence</p>
          </div>
        </div>

        <div className="card p-6 space-y-5">
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full bg-brand-50 dark:bg-brand-950 flex items-center justify-center">
              <Shield size={18} className="text-brand-600 dark:text-brand-400" />
            </div>
            <h2 className="section-title mt-2">
              {isSetup ? 'Set up a PIN' : 'Enter your PIN'}
            </h2>
            <p className="meta-text text-center">
              {isSetup
                ? 'Create a PIN to protect your financial data.'
                : 'Your data is protected. Enter your PIN to continue.'}
            </p>
          </div>

          <div className="space-y-3">
            <PinInput
              value={pin}
              onChange={v => { setPin(v); setLocalErr('') }}
              onSubmit={handleSubmit}
              label={isSetup ? 'New PIN (4–8 digits)' : 'PIN'}
            />
            {isSetup && (
              <PinInput
                value={confirm}
                onChange={v => { setConfirm(v); setLocalErr('') }}
                onSubmit={handleSubmit}
                label="Confirm PIN"
              />
            )}
          </div>

          {displayError && (
            <p role="alert" className="text-[12px] text-red-500 dark:text-red-400 text-center font-medium">
              {displayError}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={busy || !pin}
            className="btn-primary w-full py-2.5"
          >
            {busy ? 'Checking…' : isSetup ? 'Set PIN & Continue' : 'Unlock'}
          </button>

          {!isSetup && (
            <p className="text-center meta-text">
              Forgot your PIN?{' '}
              <button
                onClick={() => {
                  if (confirm('This will clear all your data. Are you sure?')) {
                    localStorage.clear()
                    window.location.reload()
                  }
                }}
                className="text-brand-600 dark:text-brand-400 hover:underline font-medium"
              >
                Reset app
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
