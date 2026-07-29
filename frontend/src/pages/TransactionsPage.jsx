import React from 'react'
import { useFinancialDataContext } from '../contexts/FinancialDataContext'
import PageHeader from '../components/PageHeader'
import TransactionTable from '../components/TransactionTable'
import ExportButton from '../components/ExportButton'
import DateRangeFilter from '../components/ui/DateRangeFilter'

function TransactionsPage() {
  const {
    transactions, overview, selectedFile, uploadedFiles, loading,
    dateRangePreset, customRange, setDateRangePreset, setCustomRange,
  } = useFinancialDataContext()

  const viewLabel = selectedFile ?? (uploadedFiles.length > 0 ? 'All Files' : null)
  const hasData = transactions.length > 0 || uploadedFiles.length > 0

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Transactions"
        subtitle={viewLabel ? `Viewing: ${viewLabel}` : 'All uploaded transactions'}
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
            {transactions.length > 0 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full
                               bg-gray-100 dark:bg-gray-800 text-[11px] font-semibold text-gray-500 dark:text-gray-400 tabular-nums">
                {transactions.length.toLocaleString()} txns
              </span>
            )}
            <ExportButton transactions={transactions} overview={overview} />
          </div>
        }
      />
      <TransactionTable transactions={transactions} loading={loading} />
    </div>
  )
}

export default TransactionsPage
