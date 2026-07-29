import React, { useState } from 'react'
import { TrendingUp, Eye, EyeOff, Loader2 } from 'lucide-react'
import { login, register, resetPassword } from '../api'
import { useUserAuth } from '../contexts/UserAuthContext'

export default function LoginPage() {
  const { loginSuccess } = useUserAuth()
  const [mode, setMode]         = useState('login')   // 'login' | 'register' | 'reset'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      if (mode === 'reset') {
        if (password.length < 6) { setError('Password must be at least 6 characters.'); setLoading(false); return }
        await resetPassword(resetToken.trim(), password)
        setSuccess('Password reset successfully. Please sign in with your new password.')
        setMode('login')
        setResetToken('')
        setPassword('')
      } else {
        let data
        if (mode === 'login') {
          data = await login(username.trim(), password)
        } else {
          if (password.length < 6) { setError('Password must be at least 6 characters.'); setLoading(false); return }
          data = await register(username.trim(), password, displayName.trim())
        }
        loginSuccess(data)
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  function toggle() {
    setMode(m => m === 'login' ? 'register' : 'login')
    setError('')
    setSuccess('')
  }

  function enterReset() {
    setMode('reset')
    setError('')
    setSuccess('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center shadow-md">
            <TrendingUp size={20} className="text-white" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-none tracking-tight">F-Insight</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-none mt-0.5">Financial Intelligence</p>
          </div>
        </div>

        {/* Card */}
        <div className="card p-6">
          <h1 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 mb-1">
            {mode === 'login' ? 'Sign in to your account' : mode === 'register' ? 'Create an account' : 'Reset password'}
          </h1>
          <p className="meta-text mb-5">
            {mode === 'login'
              ? 'Your data stays private on this device.'
              : mode === 'register'
              ? 'Your data will be private and isolated from other users.'
              : 'Paste the reset token provided by your admin.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            {mode === 'reset' ? (
              <div>
                <label htmlFor="reset_token" className="block text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reset token
                </label>
                <input
                  id="reset_token"
                  type="text"
                  autoFocus
                  required
                  value={resetToken}
                  onChange={e => setResetToken(e.target.value)}
                  placeholder="Paste token here"
                  className="input font-mono text-[11px]"
                />
              </div>
            ) : (
              <div>
                <label htmlFor="username" className="block text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="your_username"
                  className="input"
                />
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label htmlFor="display_name" className="block text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Display name <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  id="display_name"
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your Name"
                  className="input"
                />
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Min. 6 characters' : '••••••••'}
                  className="input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-[12px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}
            {success && (
              <p className="text-[12px] text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 px-3 py-2 rounded-lg">
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || (mode !== 'reset' && (!username.trim() || !password)) || (mode === 'reset' && (!resetToken.trim() || !password))}
              className="btn-primary w-full py-2.5 mt-1"
            >
              {loading
                ? <><Loader2 size={14} className="animate-spin" /> {mode === 'login' ? 'Signing in…' : mode === 'register' ? 'Creating account…' : 'Resetting…'}</>
                : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Reset password'
              }
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 text-center space-y-1">
            {mode !== 'reset' && (
              <p className="text-[12px] text-gray-500 dark:text-gray-400">
                {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
                {' '}
                <button onClick={toggle} className="text-brand-600 dark:text-brand-400 font-medium hover:underline">
                  {mode === 'login' ? 'Register' : 'Sign in'}
                </button>
              </p>
            )}
            {mode === 'login' && (
              <p className="text-[12px] text-gray-400 dark:text-gray-500">
                <button onClick={enterReset} className="hover:underline">
                  Have a reset token?
                </button>
              </p>
            )}
            {mode === 'reset' && (
              <p className="text-[12px] text-gray-500 dark:text-gray-400">
                <button onClick={() => setMode('login')} className="text-brand-600 dark:text-brand-400 font-medium hover:underline">
                  Back to sign in
                </button>
              </p>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-gray-400 dark:text-gray-600">
          100% local · no data leaves this device
        </p>
      </div>
    </div>
  )
}
