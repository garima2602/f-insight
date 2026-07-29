import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

function ThemeToggle({ className = '' }) {
  const { dark, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      className={`p-1.5 rounded-lg transition-colors
                  text-gray-400 hover:text-gray-600 hover:bg-gray-100
                  dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-800
                  focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 ${className}`}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={dark}
    >
      {dark
        ? <Sun size={15} aria-hidden="true" />
        : <Moon size={15} aria-hidden="true" />
      }
    </button>
  )
}

export default ThemeToggle
