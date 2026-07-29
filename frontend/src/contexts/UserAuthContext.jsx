import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getToken, fetchMe, logout as apiLogout, clearToken } from '../api'

export const UserAuthContext = createContext(null)

export function UserAuthProvider({ children }) {
  const [user, setUser]       = useState(null)   // { user_id, username, display_name }
  const [loading, setLoading] = useState(true)   // true while verifying token on mount

  // On mount, verify existing token
  useEffect(() => {
    async function init() {
      if (!getToken()) { setLoading(false); return }
      try {
        const me = await fetchMe()
        setUser(me)
      } catch {
        clearToken()
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  // Listen for 401s that clear the token
  useEffect(() => {
    function handleLogout() { setUser(null) }
    window.addEventListener('finsight:logout', handleLogout)
    return () => window.removeEventListener('finsight:logout', handleLogout)
  }, [])

  const loginSuccess = useCallback((userData) => {
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    apiLogout()
    setUser(null)
  }, [])

  return (
    <UserAuthContext.Provider value={{ user, loading, loginSuccess, logout }}>
      {children}
    </UserAuthContext.Provider>
  )
}

export function useUserAuth() {
  const ctx = useContext(UserAuthContext)
  if (!ctx) throw new Error('useUserAuth must be used inside UserAuthProvider')
  return ctx
}
