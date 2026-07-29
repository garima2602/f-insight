import React, { createContext, useContext } from 'react'
import { useFinancialData } from '../hooks/useFinancialData'

const FinancialDataContext = createContext(null)

export function FinancialDataProvider({ children }) {
  const value = useFinancialData()
  return (
    <FinancialDataContext.Provider value={value}>
      {children}
    </FinancialDataContext.Provider>
  )
}

export function useFinancialDataContext() {
  const ctx = useContext(FinancialDataContext)
  if (!ctx) throw new Error('useFinancialDataContext must be used inside FinancialDataProvider')
  return ctx
}
