import React, { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { FinancialDataProvider, useFinancialDataContext } from './contexts/FinancialDataContext'
import { usePageTitle } from './hooks/usePageTitle'
import Sidebar from './components/Sidebar'
import ThemeToggle from './components/ThemeToggle'
import ErrorBoundary from './components/ErrorBoundary'
import FileViewerPanel from './components/FileViewerPanel'
import Dashboard from './pages/Dashboard'
import TransactionsPage from './pages/TransactionsPage'
import ChatPage from './pages/ChatPage'
import UploadCenter from './pages/UploadCenter'
import InsightsPage from './pages/InsightsPage'
import SettingsPage from './pages/SettingsPage'

function useBackendStatus() {
  const [online, setOnline] = useState(true)
  const intervalRef = useRef(null)

  useEffect(() => {
    let isMounted = true
    async function check() {
      try {
        await fetch('/api/health', { signal: AbortSignal.timeout(3000) })
        if (isMounted) setOnline(true)
      } catch {
        if (isMounted) setOnline(false)
      }
    }
    check()
    intervalRef.current = setInterval(check, 15000)
    return () => {
      isMounted = false
      clearInterval(intervalRef.current)
    }
  }, [])

  return online
}

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [viewerFile, setViewerFile]   = useState(null)
  const pageTitle = usePageTitle()
  const backendOnline = useBackendStatus()
  const { uploadedFiles, selectedFile, setSelectedFile, onClearData, onUploadSuccess } = useFinancialDataContext()

  function handleSelectFile(filename) {
    setSelectedFile(filename)
    setSidebarOpen(false)
  }

  async function handleDeleteFile(filename) {
    // If the deleted file was selected, fall back to "all files"
    if (selectedFile === filename) setSelectedFile(null)
    // Refresh the file list and analytics
    await onUploadSuccess()
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-gray-950 overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50
                   focus:px-4 focus:py-2 focus:bg-brand-600 focus:text-white focus:rounded-lg
                   focus:text-sm focus:font-medium focus:shadow-lg"
      >
        Skip to main content
      </a>

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        uploadedFiles={uploadedFiles}
        selectedFile={selectedFile}
        onSelectFile={handleSelectFile}
        onClearData={onClearData}
        onDeleteFile={handleDeleteFile}
        onViewFile={setViewerFile}
      />

      <FileViewerPanel
        filename={viewerFile}
        onClose={() => setViewerFile(null)}
      />

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!backendOnline && (
          <div role="alert" className="shrink-0 bg-red-600 text-white text-[13px] font-medium text-center px-4 py-2 flex items-center justify-center gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="6.25" stroke="white" strokeWidth="1.5"/>
              <path d="M7 4v3.5M7 9.5v.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Backend is offline. Start the server on port 8000 to use the app.
          </div>
        )}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 shrink-0
                           dark:bg-gray-900 dark:border-gray-800">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100
                       dark:text-gray-400 dark:hover:bg-gray-800
                       focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="Open navigation"
            aria-expanded={sidebarOpen}
            aria-controls="mobile-sidebar"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <span className="font-semibold text-gray-900 dark:text-gray-100 text-[15px] flex-1">{pageTitle}</span>
          <ThemeToggle />
        </header>

        <main id="main-content" className="flex-1 overflow-y-auto" aria-label="Main content">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <ErrorBoundary>
              <Routes>
                <Route path="/"             element={<Dashboard />} />
                <Route path="/upload"       element={<UploadCenter />} />
                <Route path="/transactions" element={<TransactionsPage />} />
                <Route path="/insights"     element={<InsightsPage />} />
                <Route path="/chat"         element={<ChatPage />} />
                <Route path="/settings"     element={<SettingsPage />} />
                <Route path="*"             element={<Navigate to="/" replace />} />
              </Routes>
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  )
}

function App() {
  return (
    <FinancialDataProvider>
      <AppShell />
    </FinancialDataProvider>
  )
}

export default App
