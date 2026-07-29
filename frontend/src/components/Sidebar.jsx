import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, List, MessageSquare, Shield, TrendingUp,
  FileText, Layers, Trash2, ChevronRight, Upload, Lightbulb, Lock, Settings, X, Eye,
} from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import { useAuth } from '../contexts/AuthContext'
import { useUserAuth } from '../contexts/UserAuthContext'
import { deleteFile } from '../api'

const NAV_ITEMS = [
  { to: '/',             end: true, label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/upload',                  label: 'Upload',       icon: Upload          },
  { to: '/transactions',            label: 'Transactions', icon: List            },
  { to: '/insights',                label: 'Insights',     icon: Lightbulb       },
  { to: '/chat',                    label: 'AI Assistant', icon: MessageSquare   },
  { to: '/settings',               label: 'Settings',     icon: Settings        },
]

function Sidebar({ open, onClose, uploadedFiles, selectedFile, onSelectFile, onClearData, onDeleteFile, onViewFile }) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col w-60 shrink-0 bg-white border-r border-gray-100 h-full
                   dark:bg-gray-900 dark:border-gray-800"
        aria-label="Primary navigation"
      >
        <SidebarContent
          uploadedFiles={uploadedFiles}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
          onClearData={onClearData}
          onDeleteFile={onDeleteFile}
          onViewFile={onViewFile}
          onClose={() => {}}
        />
      </aside>

      {/* Mobile drawer */}
      <aside
        id="mobile-sidebar"
        className={`fixed inset-y-0 left-0 z-30 flex flex-col w-64 bg-white border-r border-gray-100
                    dark:bg-gray-900 dark:border-gray-800
                    transform transition-transform duration-200 ease-out lg:hidden
                    ${open ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Primary navigation"
        aria-hidden={!open}
        aria-modal={open}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <Logo />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100
                       dark:text-gray-400 dark:hover:bg-gray-800
                       focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="Close navigation"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <SidebarContent
          uploadedFiles={uploadedFiles}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
          onClearData={onClearData}
          onDeleteFile={onDeleteFile}
          onViewFile={onViewFile}
          onClose={onClose}
        />
      </aside>
    </>
  )
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center shadow-sm shrink-0">
        <TrendingUp size={14} className="text-white" aria-hidden="true" />
      </div>
      <div>
        <p className="text-[13px] font-bold text-gray-900 dark:text-gray-100 leading-none tracking-tight">F-Insight</p>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-none mt-[3px]">Financial Intelligence</p>
      </div>
    </div>
  )
}

function fmt(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
}

function SidebarContent({ uploadedFiles, selectedFile, onSelectFile, onClearData, onDeleteFile, onViewFile, onClose }) {
  const [confirmClear,  setConfirmClear]  = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(null) // filename pending confirm
  const [deleting,      setDeleting]      = React.useState(null) // filename being deleted

  const handleClearClick = () => {
    if (confirmClear) {
      onClearData()
      setConfirmClear(false)
    } else {
      setConfirmClear(true)
    }
  }

  const handleDeleteFile = async (filename) => {
    if (confirmDelete !== filename) {
      setConfirmDelete(filename)
      return
    }
    setDeleting(filename)
    setConfirmDelete(null)
    try {
      await deleteFile(filename)
      onDeleteFile?.(filename)
    } catch (err) {
      console.error('Failed to delete file:', err)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Logo — desktop only */}
      <div className="hidden lg:flex items-center px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <Logo />
      </div>

      {/* Primary nav */}
      <nav className="px-2 pt-3 pb-2 shrink-0" aria-label="Main menu">
        <p className="px-3 mb-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-[0.08em]">
          Menu
        </p>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onClose}
            className={({ isActive }) =>
              `relative w-full flex items-center gap-2.5 py-2 rounded-lg text-[13px] font-medium
               transition-all duration-150 text-left border-l-[3px] pl-[9px] pr-3
               ${isActive
                 ? 'bg-brand-50 text-brand-700 border-brand-500 dark:bg-brand-950 dark:text-brand-400'
                 : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-transparent dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
               }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  size={16}
                  className={isActive
                    ? 'text-brand-600 dark:text-brand-400 shrink-0'
                    : 'text-gray-400 dark:text-gray-500 shrink-0'
                  }
                  aria-hidden="true"
                />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Uploaded files */}
      {uploadedFiles && uploadedFiles.length > 0 && (
        <div className="flex-1 flex flex-col min-h-0 px-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <p className="px-3 mb-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-[0.08em]">
            Statements
          </p>

          <div className="flex-1 overflow-y-auto space-y-0.5 pr-0.5">
            {/* All Files aggregate */}
            <button
              onClick={() => onSelectFile(null)}
              aria-pressed={selectedFile === null}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-left border-l-[3px]
                          ${selectedFile === null
                            ? 'bg-brand-50 text-brand-700 border-brand-500 dark:bg-brand-950 dark:text-brand-400'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-transparent dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                          }`}
            >
              <Layers
                size={14}
                className={`shrink-0 ${selectedFile === null
                  ? 'text-brand-600 dark:text-brand-400'
                  : 'text-gray-400 dark:text-gray-500'
                }`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[12px] leading-tight truncate">All Files</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5">
                  {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''} ·{' '}
                  {uploadedFiles.reduce((s, f) => s + (f.row_count || 0), 0).toLocaleString()} txns
                </p>
              </div>
              {selectedFile === null && (
                <ChevronRight size={12} className="text-brand-500 dark:text-brand-400 shrink-0" aria-hidden="true" />
              )}
            </button>

            {/* Individual files */}
            {uploadedFiles.map((file) => {
              const active    = selectedFile === file.filename
              const isDeleting = deleting === file.filename
              const pendingConfirm = confirmDelete === file.filename
              return (
                <div
                  key={file.id ?? file.filename}
                  className={`group relative flex items-center gap-1 rounded-lg border-l-[3px] transition-colors
                              ${active
                                ? 'bg-brand-50 border-brand-500 dark:bg-brand-950'
                                : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'
                              }`}
                >
                  <button
                    onClick={() => onSelectFile(file.filename)}
                    aria-pressed={active}
                    title={file.filename}
                    disabled={isDeleting}
                    className={`flex-1 flex items-center gap-2.5 px-3 py-2 text-left min-w-0
                                ${active
                                  ? 'text-brand-700 dark:text-brand-400'
                                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                                } ${isDeleting ? 'opacity-40' : ''}`}
                  >
                    <FileText
                      size={13}
                      className={`shrink-0 ${active ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500'}`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[12px] leading-tight truncate">{file.filename}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5">
                        {isDeleting ? 'Deleting…' : `${file.row_count?.toLocaleString()} txns${file.date_from ? ` · ${fmt(file.date_from)}` : ''}`}
                      </p>
                    </div>
                    {active && !pendingConfirm && (
                      <ChevronRight size={11} className="text-brand-500 dark:text-brand-400 shrink-0" aria-hidden="true" />
                    )}
                  </button>

                  {/* Action buttons — visible on hover */}
                  {!isDeleting && (
                    <div className="flex items-center gap-0.5 mr-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all">
                      {/* View original file */}
                      <button
                        onClick={(e) => { e.stopPropagation(); onViewFile?.(file.filename) }}
                        aria-label={`View original file ${file.filename}`}
                        title="View original file"
                        className="p-1 rounded text-gray-400 hover:text-brand-500 dark:text-gray-600 dark:hover:text-brand-400 transition-colors"
                      >
                        <Eye size={11} aria-hidden="true" />
                      </button>
                      {/* Delete */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteFile(file.filename) }}
                        onBlur={() => { if (confirmDelete === file.filename) setConfirmDelete(null) }}
                        aria-label={pendingConfirm ? `Confirm delete ${file.filename}` : `Delete ${file.filename}`}
                        title={pendingConfirm ? 'Click again to confirm' : 'Delete this file'}
                        className={`p-1 rounded transition-all shrink-0
                          ${pendingConfirm
                            ? 'text-red-600 bg-red-50 dark:bg-red-950'
                            : 'text-gray-400 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400'
                          }`}
                      >
                        <X size={11} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Clear data */}
          <div className="pt-1.5 pb-2 shrink-0">
            <span className="sr-only" aria-live="polite" aria-atomic="true">
              {confirmClear ? 'Confirm required. Click again to clear all data.' : ''}
            </span>
            <button
              onClick={handleClearClick}
              onBlur={() => setConfirmClear(false)}
              className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg
                          text-xs font-medium transition-colors
                          focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1
                          ${confirmClear
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'text-red-400 hover:bg-red-50 hover:text-red-500 border border-red-100 dark:hover:bg-red-950 dark:border-red-900'
                          }`}
              aria-label={confirmClear ? 'Confirm: click to clear all data permanently' : 'Clear all transaction data'}
            >
              <Trash2 size={11} aria-hidden="true" />
              {confirmClear ? 'Confirm - clear all data' : 'Clear data'}
            </button>
          </div>
        </div>
      )}

      <SidebarFooter />
    </div>
  )
}

function SidebarFooter() {
  const { pinHash, lockNow } = useAuth()
  const { user, logout } = useUserAuth()
  return (
    <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 shrink-0 space-y-2">
      {/* Logged-in user */}
      {user && (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-gray-700 dark:text-gray-200 truncate">{user.display_name}</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">@{user.username}</p>
          </div>
          <button
            onClick={logout}
            className="shrink-0 text-[11px] text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors px-1.5 py-1 rounded"
            aria-label="Sign out"
            title="Sign out"
          >
            Sign out
          </button>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Shield size={12} className="text-gray-300 dark:text-gray-600 shrink-0" aria-hidden="true" />
          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug truncate">
            100% local · no data leaves your device
          </p>
        </div>
        <ThemeToggle className="shrink-0" />
      </div>
      {pinHash && (
        <button
          onClick={lockNow}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                     font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors
                     border border-gray-200 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 dark:border-gray-700"
          aria-label="Lock the app"
        >
          <Lock size={11} aria-hidden="true" />
          Lock app
        </button>
      )}
      {!pinHash && (
        <NavLink
          to="/settings"
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                     font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950
                     border border-brand-200 dark:border-brand-900 transition-colors"
        >
          <Lock size={11} aria-hidden="true" />
          Set up PIN lock
        </NavLink>
      )}
    </div>
  )
}

export default Sidebar
