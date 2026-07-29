import React from 'react'
import { useFinancialDataContext } from '../contexts/FinancialDataContext'
import PageHeader from '../components/PageHeader'
import HealthScoreGauge from '../components/HealthScoreGauge'
import AnomalyAlerts from '../components/AnomalyAlerts'
import BehavioralInsights from '../components/BehavioralInsights'
import InsightsPanel from '../components/InsightsPanel'
import ForecastPanel from '../components/ForecastPanel'

function SectionLabel({ label }) {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="text-[10px] font-semibold text-gray-300 dark:text-gray-600 uppercase tracking-[0.1em] shrink-0">
        {label}
      </span>
      <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
    </div>
  )
}

export default function InsightsPage() {
  const {
    behavioral, insights, healthScore, anomalies, forecast, transactions,
    selectedFile, uploadedFiles, loading,
  } = useFinancialDataContext()

  const viewLabel = selectedFile ?? (uploadedFiles.length > 0 ? 'All Files' : null)

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Insights"
        subtitle={viewLabel ? `Viewing: ${viewLabel}` : 'Behavioral analysis and financial health'}
      />

      <SectionLabel label="Financial Health" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <HealthScoreGauge data={healthScore} loading={loading} />
        <ForecastPanel    data={forecast}    loading={loading} />
      </div>

      <SectionLabel label="Anomaly Alerts" />
      <AnomalyAlerts data={anomalies} loading={loading} transactions={transactions} />

      <SectionLabel label="Behavioral Patterns" />
      <BehavioralInsights data={behavioral} loading={loading} />

      <SectionLabel label="Recommendations" />
      <InsightsPanel data={insights} loading={loading} />
    </div>
  )
}
