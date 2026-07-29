import React from 'react'

function EmptyState({
  icon: Icon,
  title,
  subtitle,
  iconClass = 'w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-800',
  iconSize  = 20,
  iconColor = 'text-gray-300 dark:text-gray-600',
  className = 'py-12',
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className={`${iconClass} flex items-center justify-center`}>
        <Icon size={iconSize} className={iconColor} aria-hidden="true" />
      </div>
      <div className="text-center">
        <p className="text-[13px] font-medium text-gray-500">{title}</p>
        {subtitle && <p className="meta-text mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}

export default EmptyState
