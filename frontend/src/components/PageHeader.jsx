import React from 'react'

function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between gap-4 pb-5 border-b border-gray-100 dark:border-gray-800">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {subtitle && (
          <p className="meta-text mt-1">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          {actions}
        </div>
      )}
    </div>
  )
}

export default PageHeader
