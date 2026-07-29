import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

const HASH_KEY = 'finsight_pin_hash'
const LOCK_KEY = 'finsight_locked'

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function AuthProvider({ children }) {
  const [pinHash,  setPinHash]  = useState(() => localStorage.getItem(HASH_KEY))
  const [locked,   setLocked]   = useState(() => !!localStorage.getItem(HASH_KEY))
  const [error,    setError]    = useState('')

  // Auto-lock when tab loses focus for > 5 min
  useEffect(() => {
    if (!pinHash) return
    let timer
    const handleVisibilityChange = () => {
      if (document.hidden) {
        timer = setTimeout(() => setLocked(true), 5 * 60 * 1000)
      } else {
        clearTimeout(timer)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearTimeout(timer)
    }
  }, [pinHash])

  const setupPin = useCallback(async (pin) => {
    const hash = await sha256(pin)
    localStorage.setItem(HASH_KEY, hash)
    setPinHash(hash)
    setLocked(false)
    setError('')
  }, [])

  const unlock = useCallback(async (pin) => {
    const hash = await sha256(pin)
    if (hash === pinHash) {
      setLocked(false)
      setError('')
      return true
    }
    setError('Incorrect PIN. Try again.')
    return false
  }, [pinHash])

  const removePin = useCallback(async (pin) => {
    const hash = await sha256(pin)
    if (hash !== pinHash) { setError('Incorrect PIN.'); return false }
    localStorage.removeItem(HASH_KEY)
    setPinHash(null)
    setLocked(false)
    setError('')
    return true
  }, [pinHash])

  const lockNow = useCallback(() => setLocked(true), [])
  const clearError = useCallback(() => setError(''), [])

  return (
    <AuthContext.Provider value={{ pinHash, locked, error, setupPin, unlock, removePin, lockNow, clearError }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
