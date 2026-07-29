import React from 'react'
import { CheckCircle, Info, AlertTriangle, AlertCircle, Lightbulb, ArrowRight, Sparkles } from 'lucide-react'
import { CardShell, SkeletonCard } from './ui/CardShell'
import EmptyState from './ui/EmptyState'

const TYPE_CONFIG = {
  success: {
    icon: CheckCircle,
    bg:         'bg-brand-50 dark:bg-brand-950',
    border:     'border-brand-200 dark:border-brand-900',
    icon_color: 'text-brand-600 dark:text-brand-400',
    text:       'text-brand-800 dark:text-brand-300',
  },
  info: {
    icon: Info,
    bg:         'bg-blue-50 dark:bg-blue-950',
    border:     'border-blue-200 dark:border-blue-900',
    icon_color: 'text-blue-500 dark:text-blue-400',
    text:       'text-blue-800 dark:text-blue-300',
  },
  warning: {
    icon: AlertTriangle,
    bg:         'bg-amber-50 dark:bg-amber-950',
    border:     'border-amber-200 dark:border-amber-900',
    icon_color: 'text-amber-500 dark:text-amber-400',
    text:       'text-amber-800 dark:text-amber-300',
  },
  danger: {
    icon: AlertCircle,
    bg:         'bg-red-50 dark:bg-red-950',
    border:     'border-red-200 dark:border-red-900',
    icon_color: 'text-red-500 dark:text-red-400',
    text:       'text-red-800 dark:text-red-300',
  },
}

function InsightsPanel({ data, loading }) {
  if (loading) {
    return (
      <SkeletonCard headerWidth="w-56" label="Loading financial insights">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[0, 1].map(col => (
            <div key={col}>
              <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded w-24 mb-3" />
              <div className="space-y-2">
                {[[100, 75], [85, 60], [95, 80]].map(([w1, w2], i) => (
                  <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-gray-50/80 dark:bg-gray-800/50">
                    <div className="w-3.5 h-3.5 bg-gray-100 dark:bg-gray-700 rounded shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded" style={{ width: `${w1}%` }} />
                      <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded" style={{ width: `${w2}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SkeletonCard>
    )
  }

  if (!data) {
    return (
      <CardShell title="Financial Insights & Recommendations" bareBody>
        <EmptyState
          icon={Sparkles}
          title="No insights yet"
          subtitle="Upload a statement to get personalised recommendations"
          iconClass="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950"
          iconColor="text-amber-400"
          className="py-10 px-5"
        />
      </CardShell>
    )
  }

  const insights        = data.insights        ?? []
  const recommendations = data.recommendations ?? []

  return (
    <CardShell title="Financial Insights & Recommendations">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <p className="stat-label mb-3">Key Observations</p>
          {insights.length === 0 ? (
            <p className="text-[13px] text-gray-500 dark:text-gray-400">No insights available yet.</p>
          ) : (
            <div className="space-y-2" role="list">
              {insights.map((insight, i) => {
                const cfg  = TYPE_CONFIG[insight.type] ?? TYPE_CONFIG.info
                const Icon = cfg.icon
                return (
                  <div key={i} role="listitem" className={`flex items-start gap-2.5 p-3 rounded-lg border ${cfg.bg} ${cfg.border}`}>
                    <Icon size={14} className={`${cfg.icon_color} mt-0.5 shrink-0`} aria-hidden="true" />
                    <p className={`text-[13px] leading-snug ${cfg.text}`}>{insight.message}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <p className="stat-label mb-3 flex items-center gap-1.5">
            <Lightbulb size={11} className="text-amber-500" aria-hidden="true" />
            Action Plan
          </p>
          {recommendations.length === 0 ? (
            <p className="text-[13px] text-gray-500 dark:text-gray-400">No recommendations yet.</p>
          ) : (
            <ul className="space-y-2.5" role="list">
              {recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <ArrowRight size={12} className="text-brand-500 dark:text-brand-400 mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="text-[13px] text-gray-700 dark:text-gray-300 leading-snug">{rec}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </CardShell>
  )
}

export default InsightsPanel
