import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const PAGE_LABELS = {
  '/':             'Dashboard',
  '/upload':       'Upload Center',
  '/transactions': 'Transactions',
  '/insights':     'Insights',
  '/chat':         'AI Assistant',
  '/settings':     'Settings',
}

export function usePageTitle() {
  const { pathname } = useLocation()
  const label = PAGE_LABELS[pathname] ?? 'F-Insight'

  useEffect(() => {
    document.title = `${label} · F-Insight`
  }, [label])

  return label
}
