import React, { useMemo } from 'react'
import { Upload, BarChart2, MessageSquare, Lock } from 'lucide-react'
import { useFinancialDataContext } from '../contexts/FinancialDataContext'
import PageHeader from '../components/PageHeader'
import FileUpload from '../components/FileUpload'
import StatementBanner from '../components/StatementBanner'
import OverviewCards from '../components/OverviewCards'
import CategoryChart from '../components/CategoryChart'
import MonthlyTrends from '../components/MonthlyTrends'
import MerchantList from '../components/MerchantList'
import BehavioralInsights from '../components/BehavioralInsights'
import InsightsPanel from '../components/InsightsPanel'
import SubscriptionTracker from '../components/SubscriptionTracker'
import SpendingHeatmap from '../components/SpendingHeatmap'
import BudgetGoals from '../components/BudgetGoals'
import NetWorthTracker from '../components/NetWorthTracker'
import GoalTracker from '../components/GoalTracker'
import ForecastPanel from '../components/ForecastPanel'
import DateRangeFilter from '../components/ui/DateRangeFilter'

function SectionLabel({ label }) {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-[0.1em] shrink-0">
        {label}
      </span>
      <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
    </div>
  )
}

function Dashboard() {
  const {
    overview, categories, monthly, merchants, behavioral, insights,
    subscriptions, heatmap, statementInfo, transactions, forecast, loading,
    selectedFile, uploadedFiles, onUploadSuccess,
    dateRangePreset, customRange, setDateRangePreset, setCustomRange,
  } = useFinancialDataContext()

  // Build { category: totalSpent } map for BudgetGoals
  const spendingByCategory = useMemo(() => {
    if (!categories) return {}
    return Object.fromEntries(
      (Array.isArray(categories) ? categories : Object.entries(categories).map(([k, v]) => ({ category: k, total: v })))
        .map(item => [item.category ?? item.name, item.total ?? item.amount ?? 0])
    )
  }, [categories])

  const hasData   = uploadedFiles.length > 0 || overview !== null
  const viewLabel = selectedFile ?? (uploadedFiles.length > 0 ? 'All Files' : null)

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Dashboard"
        subtitle={viewLabel ? `Viewing: ${viewLabel}` : 'Your financial overview at a glance'}
        actions={
          <div className="flex items-center gap-3">
            {hasData && (
              <DateRangeFilter
                preset={dateRangePreset}
                onPresetChange={setDateRangePreset}
                customRange={customRange}
                onCustomRangeChange={setCustomRange}
              />
            )}
            {hasData && <FileUpload onUploadSuccess={onUploadSuccess} compact />}
          </div>
        }
      />

      {!hasData && (
        <div className="space-y-5">
          <FileUpload onUploadSuccess={onUploadSuccess} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: Upload,       step: '1', title: 'Upload a statement', desc: 'Drag & drop your bank PDF or CSV above. HDFC and SBI are fully supported.' },
              { icon: BarChart2,    step: '2', title: 'Explore your data',  desc: 'Get a full breakdown of spending, trends, merchants, and budget goals.' },
              { icon: MessageSquare, step: '3', title: 'Chat with AI',      desc: 'Ask questions in plain English. Requires Ollama running locally.' },
            ].map(({ icon: Icon, step, title, desc }) => (
              <div key={step} className="card p-5 flex gap-4 items-start">
                <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-950 flex items-center justify-center shrink-0">
                  <Icon size={15} className="text-brand-600 dark:text-brand-400" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 mb-0.5">Step {step}</p>
                  <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 mb-1">{title}</p>
                  <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-snug">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="card p-4 flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50">
            <Lock size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[12px] text-amber-700 dark:text-amber-300 leading-snug">
              <span className="font-semibold">Your data stays local.</span> Nothing is uploaded to any server.
              All processing happens on your machine at <code className="font-mono text-[11px]">localhost:8000</code>.
            </p>
          </div>
        </div>
      )}

      <StatementBanner data={statementInfo} />
      <OverviewCards data={overview} loading={loading} />

      <SectionLabel label="Spending Analysis" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <CategoryChart data={categories} loading={loading} />
        <MonthlyTrends data={monthly}    loading={loading} />
      </div>

      <SectionLabel label="Spending Calendar" />
      <SpendingHeatmap data={heatmap} loading={loading} transactions={transactions} />

      <SectionLabel label="Goals & Net Worth" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <BudgetGoals spendingByCategory={spendingByCategory} />
        <GoalTracker currentSavings={overview?.net_cashflow ?? 0} />
        <NetWorthTracker />
      </div>

      <SectionLabel label="Merchants & Habits" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MerchantList       data={merchants}  loading={loading} />
        <BehavioralInsights data={behavioral} loading={loading} />
      </div>

      <SectionLabel label="Recurring Payments" />
      <SubscriptionTracker data={subscriptions} loading={loading} />

      <SectionLabel label="Cash Flow Forecast" />
      <ForecastPanel data={forecast} loading={loading} />

      <SectionLabel label="Recommendations" />
      <InsightsPanel data={insights} loading={loading} />
    </div>
  )
}

export default Dashboard
