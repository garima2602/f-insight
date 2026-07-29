import React from 'react'

// stretch=true  → flex flex-col on root + flex-1 on body (charts, MerchantList)
// flex=true     → flex flex-col on root only, no flex-1 body (BehavioralInsights)
// bareBody=true → children rendered directly after header, no card-body wrapper
export function SkeletonCard({
  interactive = true,
  flex        = false,
  stretch     = false,
  headerWidth = 'w-32',
  bodyClass   = '',
  label       = 'Loading',
  children,
}) {
  const isFlexRoot = flex || stretch
  const root = [interactive ? 'card-interactive' : 'card', isFlexRoot && 'flex flex-col'].filter(Boolean).join(' ')
  const body = ['card-body', stretch && 'flex-1', 'animate-pulse', bodyClass].filter(Boolean).join(' ')
  return (
    <div className={root} role="status" aria-label={label} aria-busy="true">
      <div className="card-header" aria-hidden="true">
        <div className={`h-4 bg-gray-100 dark:bg-gray-800 rounded ${headerWidth} animate-pulse`} />
      </div>
      <div className={body} aria-hidden="true">{children}</div>
    </div>
  )
}

export function CardShell({
  title,
  action,
  children,
  interactive = true,
  flex        = false,
  stretch     = false,
  bodyClass   = '',
  bareBody    = false,
}) {
  const isFlexRoot = flex || stretch
  const root = [interactive ? 'card-interactive' : 'card', isFlexRoot && 'flex flex-col'].filter(Boolean).join(' ')
  const body = ['card-body', stretch && 'flex-1', bodyClass].filter(Boolean).join(' ')
  return (
    <div className={root}>
      <div className="card-header flex items-center justify-between">
        <h3 className="section-title">{title}</h3>
        {action}
      </div>
      {bareBody ? children : <div className={body}>{children}</div>}
    </div>
  )
}
