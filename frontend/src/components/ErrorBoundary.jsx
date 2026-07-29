import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Render error:', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const message = this.state.error?.message || 'An unexpected error occurred.'

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" role="alert" aria-live="assertive">
        <div className="card max-w-md w-full p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
              <AlertTriangle size={26} className="text-red-500" aria-hidden="true" />
            </div>
          </div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-sm text-gray-500 mb-6 break-words leading-relaxed">{message}</p>
          <button onClick={this.handleReset} className="btn-primary mx-auto">
            <RefreshCw size={14} aria-hidden="true" />
            Try again
          </button>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
