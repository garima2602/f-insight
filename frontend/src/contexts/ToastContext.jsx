import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

let _uid = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const push = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++_uid
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  const dismiss = useCallback(id => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map(t => (
          <Toast key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function Toast({ toast, onDismiss }) {
  const icons = { success: CheckCircle, error: AlertCircle, info: Info }
  const colors = {
    success: 'bg-brand-50 dark:bg-brand-950 border-brand-200 dark:border-brand-800 text-brand-800 dark:text-brand-200',
    error:   'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
    info:    'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100',
  }
  const iconColors = { success: 'text-brand-500', error: 'text-red-500', info: 'text-gray-400' }
  const Icon = icons[toast.type] ?? Info

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg
                  animate-fade-in text-[13px] font-medium ${colors[toast.type] ?? colors.info}`}
    >
      <Icon size={15} className={`shrink-0 mt-0.5 ${iconColors[toast.type]}`} aria-hidden="true" />
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss notification"
      >
        <X size={13} />
      </button>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx.push
}
