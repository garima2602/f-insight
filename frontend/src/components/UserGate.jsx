import React from 'react'
import LoginPage from '../pages/LoginPage'
import { useUserAuth } from '../contexts/UserAuthContext'

export default function UserGate({ children }) {
  const { user, loading } = useUserAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-950">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-brand-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <LoginPage />
  return <>{children}</>
}
