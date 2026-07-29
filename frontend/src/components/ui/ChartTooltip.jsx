import React from 'react'

function ChartTooltip({ children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700
                     rounded-xl shadow-dropdown px-3.5 py-2.5 text-xs ${className}`}>
      {children}
    </div>
  )
}

export default ChartTooltip
