import React from 'react'
import LockScreen from './LockScreen'
import { useAuth } from '../contexts/AuthContext'

export default function AuthGate({ children }) {
  const { locked } = useAuth()
  if (locked) return <LockScreen />
  return <>{children}</>
}
