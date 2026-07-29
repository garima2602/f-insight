import React from 'react'
import { Zap, Calendar, Repeat, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react'
import { CardShell, SkeletonCard } from './ui/CardShell'
import EmptyState from './ui/EmptyState'

function MetricRow({ icon: Icon, iconBg, iconColor, label, value, sub }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0">
      <div className={`${iconBg} p-2 rounded-lg shrink-0`} aria-hidden="true">
        <Icon size={14} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-[0.05em]">{label}</p>
        <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 mt-1 truncate">{value}</p>
        {sub && <p className="meta-text mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function BehavioralInsights({ data, loading }) {
  if (loading) {
    return (
      <SkeletonCard interactive={false} flex headerWidth="w-36" label="Loading behavioral insights">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-start gap-3 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0">
            <div className="w-9 h-9 bg-gray-100 dark:bg-gray-800 rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5 pt-0.5">
              <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded w-28" />
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-44" />
              <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded w-36" />
            </div>
          </div>
        ))}
      </SkeletonCard>
    )
  }

  if (!data) {
    return (
      <CardShell title="Behavioral Insights" interactive={false} flex bareBody>
        <EmptyState
          icon={Activity}
          title="No behavioral data yet"
          subtitle="Upload a statement to analyze spending patterns"
          className="py-14 px-5"
        />
      </CardShell>
    )
  }

  const velocity     = data.spending_velocity?.trend ?? 'stable'
  const changePct    = data.spending_velocity?.change_pct ?? 0
  const VelocityIcon = velocity === 'increasing' ? TrendingUp
                     : velocity === 'decreasing' ? TrendingDown
                     : Minus

  const metrics = [
    {
      icon: Zap,
      iconBg: 'bg-amber-50 dark:bg-amber-950', iconColor: 'text-amber-500',
      label: 'Impulse Spending',
      value: `${data.impulse_spending?.count ?? 0} potential transactions`,
      sub: data.impulse_spending?.total
        ? `₹${data.impulse_spending.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })} total`
        : 'None detected this period',
    },
    {
      icon: Calendar,
      iconBg: 'bg-blue-50 dark:bg-blue-950', iconColor: 'text-blue-500',
      label: 'Weekend vs Weekday Spend',
      value: `₹${(data.weekend_vs_weekday?.weekend_avg ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} / ₹${(data.weekend_vs_weekday?.weekday_avg ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      sub: 'Weekend avg / Weekday avg per transaction',
    },
    {
      icon: Repeat,
      iconBg: 'bg-purple-50 dark:bg-purple-950', iconColor: 'text-purple-500',
      label: 'Recurring Subscriptions',
      value: `${data.recurring_subscriptions?.length ?? 0} detected`,
      sub: data.recurring_subscriptions?.length
        ? `₹${data.recurring_subscriptions.reduce((s, r) => s + (r.amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}/month total`
        : 'No subscriptions detected',
    },
    {
      icon: VelocityIcon,
      iconBg: velocity === 'increasing' ? 'bg-red-50 dark:bg-red-950'
            : velocity === 'decreasing' ? 'bg-brand-50 dark:bg-brand-950'
            : 'bg-gray-50 dark:bg-gray-800',
      iconColor: velocity === 'increasing' ? 'text-red-500'
               : velocity === 'decreasing' ? 'text-brand-600 dark:text-brand-400'
               : 'text-gray-400 dark:text-gray-500',
      label: 'Spending Velocity',
      value: velocity.charAt(0).toUpperCase() + velocity.slice(1),
      sub: changePct !== 0 ? `${changePct > 0 ? '+' : ''}${changePct}% vs last month` : 'No change vs last month',
    },
  ]

  const badge = data.lifestyle_score?.label ? (
    <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
      {data.lifestyle_score.label}
    </span>
  ) : null

  return (
    <CardShell title="Behavioral Insights" interactive={false} flex action={badge}>
      {metrics.map((m, i) => <MetricRow key={i} {...m} />)}
    </CardShell>
  )
}

export default BehavioralInsights
