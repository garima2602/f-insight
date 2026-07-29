import React, { createContext, useContext, useState, useCallback } from 'react'

const STORAGE_KEY = 'finsight_merchant_rules'

const MerchantRulesContext = createContext(null)

export function MerchantRulesProvider({ children }) {
  const [rules, setRules] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
    catch { return {} }
  })

  const saveRule = useCallback((merchant, category) => {
    if (!merchant) return
    setRules(prev => {
      const next = { ...prev, [merchant.toLowerCase().trim()]: category }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const removeRule = useCallback((merchant) => {
    setRules(prev => {
      const next = { ...prev }
      delete next[merchant.toLowerCase().trim()]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const getCategory = useCallback((merchant) => {
    if (!merchant) return null
    return rules[merchant.toLowerCase().trim()] ?? null
  }, [rules])

  return (
    <MerchantRulesContext.Provider value={{ rules, saveRule, removeRule, getCategory }}>
      {children}
    </MerchantRulesContext.Provider>
  )
}

export function useMerchantRules() {
  const ctx = useContext(MerchantRulesContext)
  if (!ctx) throw new Error('useMerchantRules must be used inside MerchantRulesProvider')
  return ctx
}
