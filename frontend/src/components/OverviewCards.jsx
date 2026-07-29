import React from 'react'
import { TrendingUp, TrendingDown, Wallet, PiggyBank } from 'lucide-react'

const formatINR = (val) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(val)

const STAGGER = ['stagger-1', 'stagger-2', 'stagger-3', 'stagger-4']

function OverviewCards({ data, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" role="status" aria-label="Loading overview">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-5 animate-pulse overflow-hidden">
            <div className="h-1 bg-gray-100 dark:bg-gray-800 rounded-full mb-5 -mx-5 -mt-5" />
            <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded w-20 mb-5" />
            <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded w-28 mb-3" />
            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-16" />
          </div>
        ))}
      </div>
    )
  }

  const cardDefs = [
    {
      label: 'Total Income',   icon: TrendingUp,
      iconColor: 'text-brand-600 dark:text-brand-400',
      iconBg:    'bg-brand-50 dark:bg-brand-950',
      accent:    'bg-brand-500',
    },
    {
      label: 'Total Expenses', icon: TrendingDown,
      iconColor: 'text-red-500 dark:text-red-400',
      iconBg:    'bg-red-50 dark:bg-red-950',
      accent:    'bg-red-400',
    },
    {
      label: 'Net Savings',    icon: PiggyBank,
      iconColor: 'text-gray-400 dark:text-gray-500',
      iconBg:    'bg-gray-50 dark:bg-gray-800',
      accent:    'bg-gray-300 dark:bg-gray-700',
    },
    {
      label: 'Savings Rate',   icon: Wallet,
      iconColor: 'text-amber-500',
      iconBg:    'bg-amber-50 dark:bg-amber-950',
      accent:    'bg-amber-400',
    },
  ]

  if (!data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cardDefs.map(({ label, icon: Icon, iconColor, iconBg, accent }, i) => (
          <div key={label} className={`card-interactive relative overflow-hidden p-5 animate-fade-in-up ${STAGGER[i]}`}>
            <div className={`absolute top-0 inset-x-0 h-[3px] ${accent} rounded-t-card`} aria-hidden="true" />
            <div className="flex items-start justify-between mb-4">
              <span className="stat-label">{label}</span>
              <div className={`${iconBg} p-2 rounded-lg shrink-0`}>
                <Icon size={14} className={iconColor} aria-hidden="true" />
              </div>
            </div>
            <p className="text-3xl font-bold tracking-tight leading-none text-gray-200 dark:text-gray-700">-</p>
          </div>
        ))}
      </div>
    )
  }

  const cards = [
    {
      label:      'Total Income',
      value:      formatINR(data.total_income),
      sub:        `Avg ₹${(data.avg_monthly_income || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}/mo`,
      icon:       TrendingUp,
      iconColor:  'text-brand-600 dark:text-brand-400',
      iconBg:     'bg-brand-50 dark:bg-brand-950',
      valueColor: 'text-brand-700 dark:text-brand-400',
      accent:     'bg-brand-500',
    },
    {
      label:      'Total Expenses',
      value:      formatINR(data.total_expenses),
      sub:        `Avg ₹${(data.avg_monthly_expenses || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}/mo`,
      icon:       TrendingDown,
      iconColor:  'text-red-500 dark:text-red-400',
      iconBg:     'bg-red-50 dark:bg-red-950',
      valueColor: 'text-red-600 dark:text-red-400',
      accent:     'bg-red-400',
    },
    {
      label:      'Net Savings',
      value:      formatINR(data.net_cashflow),
      sub:        `${data.months_covered || 0} month${data.months_covered !== 1 ? 's' : ''} covered`,
      icon:       PiggyBank,
      iconColor:  data.net_cashflow >= 0
        ? 'text-brand-600 dark:text-brand-400'
        : 'text-red-500 dark:text-red-400',
      iconBg:     data.net_cashflow >= 0
        ? 'bg-brand-50 dark:bg-brand-950'
        : 'bg-red-50 dark:bg-red-950',
      valueColor: data.net_cashflow >= 0
        ? 'text-brand-700 dark:text-brand-400'
        : 'text-red-600 dark:text-red-400',
      accent:     data.net_cashflow >= 0 ? 'bg-brand-500' : 'bg-red-400',
    },
    {
      label:      'Savings Rate',
      value:      `${data.savings_rate}%`,
      sub:        data.savings_rate >= 20 ? '✓ Healthy (20%+ target)' : 'Target: 20%+',
      icon:       Wallet,
      iconColor:  data.savings_rate >= 20
        ? 'text-brand-600 dark:text-brand-400'
        : 'text-amber-500',
      iconBg:     data.savings_rate >= 20
        ? 'bg-brand-50 dark:bg-brand-950'
        : 'bg-amber-50 dark:bg-amber-950',
      valueColor: data.savings_rate >= 20
        ? 'text-brand-700 dark:text-brand-400'
        : 'text-amber-600 dark:text-amber-400',
      accent:     data.savings_rate >= 20 ? 'bg-brand-500' : 'bg-amber-400',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <div
          key={card.label}
          className={`card-interactive relative overflow-hidden p-5 animate-fade-in-up ${STAGGER[i]}`}
        >
          <div className={`absolute top-0 inset-x-0 h-[3px] ${card.accent} rounded-t-card`} aria-hidden="true" />
          <div className="flex items-start justify-between mb-4">
            <span className="stat-label">{card.label}</span>
            <div className={`${card.iconBg} p-2 rounded-lg shrink-0`}>
              <card.icon size={14} className={card.iconColor} aria-hidden="true" />
            </div>
          </div>
          <p className={`text-3xl font-bold tracking-tight leading-none ${card.valueColor}`}>
            {card.value}
          </p>
          <p className="meta-text mt-2">{card.sub}</p>
        </div>
      ))}
    </div>
  )
}

export default OverviewCards
