import { useState, useEffect, useCallback } from 'react'
import {
  getOverview, getCategories, getMonthlyTrends, getMerchants,
  getBehavioral, getInsights, getTransactions, getStatementInfo,
  getUploadedFiles, clearData,
  getSubscriptions, getHeatmap, getHealthScore, getAnomalies, getForecast,
} from '../api'

// Preset date ranges relative to today
export function buildPresetRange(preset) {
  if (!preset || preset === 'all') return null
  const to   = new Date()
  const from = new Date()
  if (preset === '30d')  from.setDate(from.getDate() - 30)
  if (preset === '3m')   from.setMonth(from.getMonth() - 3)
  if (preset === '6m')   from.setMonth(from.getMonth() - 6)
  if (preset === '12m')  from.setFullYear(from.getFullYear() - 1)
  return {
    from: from.toISOString().split('T')[0],
    to:   to.toISOString().split('T')[0],
  }
}

export function useFinancialData() {
  const [overview,      setOverview]      = useState(null)
  const [categories,    setCategories]    = useState(null)
  const [monthly,       setMonthly]       = useState(null)
  const [merchants,     setMerchants]     = useState(null)
  const [behavioral,    setBehavioral]    = useState(null)
  const [insights,      setInsights]      = useState(null)
  const [transactions,  setTransactions]  = useState([])
  const [statementInfo, setStatementInfo] = useState(null)
  const [subscriptions, setSubscriptions] = useState(null)
  const [heatmap,       setHeatmap]       = useState(null)
  const [healthScore,   setHealthScore]   = useState(null)
  const [anomalies,     setAnomalies]     = useState(null)
  const [forecast,      setForecast]      = useState(null)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [selectedFile,  setSelectedFile]  = useState(null)
  const [loading,       setLoading]       = useState(false)

  // dateRangePreset: 'all' | '30d' | '3m' | '6m' | '12m' | 'custom'
  const [dateRangePreset, setDateRangePreset] = useState('all')
  // customRange: { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' } | null
  const [customRange, setCustomRange] = useState(null)

  const activeDateRange = dateRangePreset === 'custom'
    ? (customRange && customRange.from <= customRange.to ? customRange : null)
    : buildPresetRange(dateRangePreset)

  const refreshFileList = useCallback(async () => {
    try {
      const data = await getUploadedFiles()
      setUploadedFiles(data.files || [])
    } catch (err) {
      console.error('Failed to load file list:', err)
    }
  }, [])

  const refreshData = useCallback(async (sourceFile, dateRange) => {
    setLoading(true)
    try {
      const [ov, cat, mon, mer, beh, ins, txn, info, subs, heat, hs, anom, fore] = await Promise.all([
        getOverview(sourceFile, dateRange),
        getCategories(sourceFile, dateRange),
        getMonthlyTrends(sourceFile, dateRange),
        getMerchants(sourceFile, dateRange),
        getBehavioral(sourceFile, dateRange),
        getInsights(sourceFile, dateRange),
        getTransactions(sourceFile, dateRange),
        getStatementInfo(sourceFile),
        getSubscriptions(sourceFile).catch(() => null),
        getHeatmap(sourceFile, dateRange).catch(() => null),
        getHealthScore(sourceFile).catch(() => null),
        getAnomalies(sourceFile).catch(() => null),
        getForecast(sourceFile).catch(() => null),
      ])
      setOverview(ov);       setCategories(cat);  setMonthly(mon);       setMerchants(mer)
      setBehavioral(beh);    setInsights(ins);    setTransactions(txn);  setStatementInfo(info)
      setSubscriptions(subs); setHeatmap(heat);   setHealthScore(hs);    setAnomalies(anom)
      setForecast(fore)
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshFileList()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refreshData(selectedFile, activeDateRange)
  }, [selectedFile, dateRangePreset, customRange]) // eslint-disable-line react-hooks/exhaustive-deps

  const onUploadSuccess = useCallback(async () => {
    await refreshFileList()
    await refreshData(selectedFile, activeDateRange)
  }, [refreshFileList, refreshData, selectedFile, activeDateRange])

  const onClearData = useCallback(async () => {
    try {
      await clearData()
      setUploadedFiles([]);   setSelectedFile(null);   setOverview(null)
      setCategories(null);    setMonthly(null);        setMerchants(null)
      setBehavioral(null);    setInsights(null);       setTransactions([])
      setStatementInfo(null); setSubscriptions(null);  setHeatmap(null)
      setHealthScore(null);   setAnomalies(null);      setForecast(null)
    } catch (err) {
      console.error('Failed to clear data:', err)
    }
  }, [])

  return {
    overview, categories, monthly, merchants, behavioral, insights,
    transactions, statementInfo, subscriptions, heatmap, healthScore,
    anomalies, forecast, uploadedFiles, selectedFile, loading,
    dateRangePreset, customRange, activeDateRange,
    setSelectedFile, setDateRangePreset, setCustomRange,
    onUploadSuccess, onClearData, refreshData,
  }
}
