import React, { createContext, useContext, useState, useCallback } from 'react'

const BudgetContext = createContext(null)

const STORAGE_KEY = 'finsight_budgets'

const DEFAULT_BUDGETS = {
  Food: 0, Travel: 0, Shopping: 0, Entertainment: 0,
  Bills: 0, Investment: 0, Health: 0, Education: 0,
  Subscriptions: 0, Others: 0,
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULT_BUDGETS, ...JSON.parse(raw) } : { ...DEFAULT_BUDGETS }
  } catch {
    return { ...DEFAULT_BUDGETS }
  }
}

export function BudgetProvider({ children }) {
  const [budgets, setBudgets] = useState(load)

  const setBudget = useCallback((category, amount) => {
    setBudgets(prev => {
      const next = { ...prev, [category]: Number(amount) || 0 }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const setBulk = useCallback((obj) => {
    setBudgets(prev => {
      const next = { ...prev, ...obj }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return (
    <BudgetContext.Provider value={{ budgets, setBudget, setBulk }}>
      {children}
    </BudgetContext.Provider>
  )
}

export function useBudget() {
  const ctx = useContext(BudgetContext)
  if (!ctx) throw new Error('useBudget must be used inside BudgetProvider')
  return ctx
}
