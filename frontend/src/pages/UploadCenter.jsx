import React, { useState, useRef, useCallback, useId } from 'react'
import {
  Upload, CheckCircle, AlertCircle, X, FileText,
  Table2, FileSpreadsheet, Loader2, AlertTriangle,
  Eye, EyeOff, ArrowRight, RefreshCw,
} from 'lucide-react'
import { uploadFile, previewFile } from '../api'
import { useFinancialDataContext } from '../contexts/FinancialDataContext'
import PageHeader from '../components/PageHeader'

const MAX_FILES = 20

const FORMAT_ICONS = {
  csv:  { icon: Table2,          color: 'text-brand-600 bg-brand-50 dark:bg-brand-950 dark:text-brand-400' },
  xlsx: { icon: FileSpreadsheet, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400'    },
  xls:  { icon: FileSpreadsheet, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400'    },
  pdf:  { icon: FileText,        color: 'text-red-500 bg-red-50 dark:bg-red-950 dark:text-red-400'        },
}

function ext(filename) {
  return filename.split('.').pop().toLowerCase()
}

function FileIcon({ filename, size = 16 }) {
  const e = ext(filename)
  const meta = FORMAT_ICONS[e] ?? FORMAT_ICONS.pdf
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${meta.color}`}>
      <Icon size={size} aria-hidden="true" />
    </span>
  )
}

function StatusBadge({ status }) {
  const map = {
    queued:     { label: 'Ready to upload', cls: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400' },
    previewing: { label: 'Previewing…',     cls: 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400' },
    previewed:  { label: 'Previewed',       cls: 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400' },
    uploading:  { label: 'Uploading…',      cls: 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400' },
    complete:   { label: 'Saved',           cls: 'bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-400' },
    failed:     { label: 'Failed',          cls: 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400' },
  }
  const { label, cls } = map[status] ?? map.queued
  const spin = status === 'uploading' || status === 'previewing'
  const ok   = status === 'complete'
  const bad  = status === 'failed'
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {spin && <Loader2 size={9} className="animate-spin" aria-hidden="true" />}
      {ok   && <CheckCircle size={9} aria-hidden="true" />}
      {bad  && <AlertCircle size={9} aria-hidden="true" />}
      {label}
    </span>
  )
}

function fmt(val) {
  if (!val || val === 0) return ''
  return `₹${Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

function PreviewPanel({ data }) {
  const rows  = data.rows  || []
  const total = data.total_parsed ?? rows.length
  const shown = rows.length

  return (
    <div className="mt-3 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in">
      {/* Summary */}
      <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-[11px] flex-wrap">
        <span className="font-semibold text-gray-700 dark:text-gray-200">{total.toLocaleString()} transactions parsed</span>
        <span className="text-green-600 dark:text-green-400">{data.deposits} deposits</span>
        <span className="text-red-500 dark:text-red-400">{data.withdrawals} withdrawals</span>
        <span className="uppercase font-semibold text-gray-400 dark:text-gray-500 tracking-wide ml-auto">{data.file_type}</span>
        {shown < total && (
          <span className="text-amber-600 dark:text-amber-400">showing first {shown}</span>
        )}
      </div>
      {/* Table */}
      <div className="overflow-x-auto max-h-64 overflow-y-auto">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
            <tr>
              {['Date','Narration','Merchant','Category','Debit','Credit'].map(h => (
                <th key={h} className="text-left px-3 py-2 font-semibold text-gray-400 dark:text-gray-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50/60 dark:hover:bg-gray-800/40">
                <td className="px-3 py-1.5 whitespace-nowrap text-gray-500 dark:text-gray-400 font-mono text-[11px]">{row.date || '-'}</td>
                <td className="px-3 py-1.5 max-w-[200px] truncate text-gray-700 dark:text-gray-200" title={row.narration}>{row.narration}</td>
                <td className="px-3 py-1.5 max-w-[110px] truncate text-gray-500 dark:text-gray-400">{row.merchant || '-'}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{row.category}</span>
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap text-red-500 dark:text-red-400 font-medium">{fmt(row.debit)}</td>
                <td className="px-3 py-1.5 whitespace-nowrap text-green-600 dark:text-green-400 font-medium">{fmt(row.credit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function UploadCenter() {
  const { onUploadSuccess } = useFinancialDataContext()
  const [queue, setQueue]       = useState([])
  const [dragOver, setDragOver] = useState(false)
  const [batchWarn, setBatchWarn] = useState(false)
  const [showPreview, setShowPreview] = useState({})   // id → bool
  const inputId = useId()
  const fileRef = useRef(null)

  const addFiles = useCallback((files) => {
    const arr = Array.from(files)
    if (arr.length > MAX_FILES) setBatchWarn(true)
    const accepted = arr.slice(0, MAX_FILES)
    const entries = accepted.map(f => ({
      id:          Math.random().toString(36).slice(2),
      file:        f,
      status:      'queued',
      previewData: null,
      result:      null,
      error:       null,
    }))
    setQueue(prev => [...prev, ...entries])
    // No auto-upload — user decides
  }, [])

  const previewEntry = useCallback(async (id, file) => {
    setQueue(prev => prev.map(e => e.id === id ? { ...e, status: 'previewing', error: null } : e))
    setShowPreview(prev => ({ ...prev, [id]: true }))
    try {
      const data = await previewFile(file)
      setQueue(prev => prev.map(e => e.id === id ? { ...e, status: 'previewed', previewData: data } : e))
    } catch (err) {
      setQueue(prev => prev.map(e => e.id === id
        ? { ...e, status: 'failed', error: err.message || 'Preview failed' }
        : e
      ))
    }
  }, [])

  const uploadEntry = useCallback(async (id, file) => {
    setQueue(prev => prev.map(e => e.id === id ? { ...e, status: 'uploading', error: null } : e))
    try {
      const result = await uploadFile(file)
      setQueue(prev => prev.map(e => e.id === id ? { ...e, status: 'complete', result } : e))
      await onUploadSuccess()
    } catch (err) {
      setQueue(prev => prev.map(e => e.id === id
        ? { ...e, status: 'failed', error: err.message || 'Upload failed' }
        : e
      ))
    }
  }, [onUploadSuccess])

  const uploadAll = useCallback(() => {
    queue
      .filter(e => e.status === 'queued' || e.status === 'previewed')
      .forEach(e => uploadEntry(e.id, e.file))
  }, [queue, uploadEntry])

  const removeEntry    = (id) => setQueue(prev => prev.filter(e => e.id !== id))
  const clearComplete  = ()   => setQueue(prev => prev.filter(e => e.status !== 'complete'))
  const togglePreview  = (id) => setShowPreview(prev => ({ ...prev, [id]: !prev[id] }))

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    addFiles(e.dataTransfer.files)
  }

  const queuedCount   = queue.filter(e => e.status === 'queued' || e.status === 'previewed').length
  const completeCount = queue.filter(e => e.status === 'complete').length
  const failedCount   = queue.filter(e => e.status === 'failed').length
  const activeCount   = queue.filter(e => e.status === 'uploading' || e.status === 'previewing').length

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Upload Center"
        subtitle="Preview your statement before saving — nothing is stored until you confirm"
        actions={
          <div className="flex items-center gap-2">
            {completeCount > 0 && (
              <button onClick={clearComplete} className="btn-ghost text-[12px] px-3 py-1.5">
                Clear completed
              </button>
            )}
            {queuedCount > 1 && (
              <button onClick={uploadAll} className="btn-primary text-[12px] px-3 py-1.5 flex items-center gap-1.5">
                <ArrowRight size={12} /> Upload all ({queuedCount})
              </button>
            )}
          </div>
        }
      />

      {batchWarn && (
        <div role="alert" className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
          <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-amber-800 dark:text-amber-300">Batch limit reached</p>
            <p className="meta-text text-amber-700 dark:text-amber-400 mt-0.5">
              Only the first {MAX_FILES} files were accepted. Upload remaining files separately.
            </p>
          </div>
          <button onClick={() => setBatchWarn(false)} aria-label="Dismiss" className="text-amber-500 hover:text-amber-700"><X size={14} /></button>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false) }}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click() } }}
        className={`card flex flex-col items-center gap-4 px-6 py-12 border-2 border-dashed text-center
                    transition-all duration-150 cursor-pointer select-none
                    ${dragOver
                      ? 'border-brand-400 dark:border-brand-500 bg-brand-50 dark:bg-brand-950'
                      : 'border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-700'
                    }`}
        role="button"
        tabIndex={0}
        aria-label="Drop files here or click to browse"
      >
        <input
          id={inputId} ref={fileRef} type="file" className="sr-only"
          accept=".csv,.xlsx,.xls,.pdf,.ofx,.qfx,.qif,.json"
          multiple
          aria-label="Choose bank statement files"
          onChange={e => { addFiles(e.target.files); e.target.value = '' }}
        />
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors
                        ${dragOver ? 'bg-brand-100 dark:bg-brand-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
          <Upload size={24} className={dragOver ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500'} aria-hidden="true" />
        </div>
        <div>
          <p className="text-[15px] font-semibold text-gray-700 dark:text-gray-200">
            Drop files here, or <span className="text-brand-600 dark:text-brand-400">browse</span>
          </p>
          <p className="meta-text mt-1">PDF, CSV, XLSX · up to 50 MB · max {MAX_FILES} files</p>
        </div>
        <div className="flex items-center gap-2" aria-label="Supported formats">
          {['CSV', 'XLSX', 'PDF', 'OFX', 'QIF'].map(f => (
            <span key={f} className="badge bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 text-[11px] font-semibold rounded-md">{f}</span>
          ))}
        </div>
      </div>

      {/* Queue */}
      {queue.length > 0 && (
        <section aria-label="Upload queue" className="card">
          <div className="card-header flex items-center justify-between">
            <div>
              <h2 className="section-title">Files</h2>
              <p className="meta-text mt-0.5">
                {completeCount > 0 && `${completeCount} saved`}
                {queuedCount  > 0 && `${completeCount > 0 ? ' · ' : ''}${queuedCount} pending`}
                {failedCount  > 0 && ` · ${failedCount} failed`}
                {activeCount  > 0 && ` · ${activeCount} in progress`}
              </p>
            </div>
          </div>

          <ul className="divide-y divide-gray-50 dark:divide-gray-800" aria-label="Uploaded files">
            {queue.map(entry => {
              const isPending  = entry.status === 'queued' || entry.status === 'previewed'
              const isActive   = entry.status === 'uploading' || entry.status === 'previewing'
              const isDone     = entry.status === 'complete'
              const isFailed   = entry.status === 'failed'
              const hasPreview = !!entry.previewData
              const previewOpen = showPreview[entry.id] && hasPreview

              return (
                <li key={entry.id} className="px-5 py-3.5">
                  {/* File row */}
                  <div className="flex items-center gap-4">
                    <FileIcon filename={entry.file.name} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 truncate">{entry.file.name}</p>
                      {entry.result && (
                        <p className="meta-text mt-0.5">
                          {entry.result.transactions_parsed?.toLocaleString()} transactions saved
                          · {entry.result.deposits} deposits · {entry.result.withdrawals} withdrawals
                        </p>
                      )}
                      {entry.previewData && !entry.result && (
                        <p className="meta-text mt-0.5 text-blue-600 dark:text-blue-400">
                          {entry.previewData.total_parsed?.toLocaleString()} transactions found — preview below
                        </p>
                      )}
                      {entry.error && (
                        <p className="meta-text text-red-500 dark:text-red-400 mt-0.5">{entry.error}</p>
                      )}
                    </div>

                    <StatusBadge status={entry.status} />

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Preview toggle */}
                      {(isPending || isFailed) && !isActive && (
                        <button
                          onClick={() => hasPreview ? togglePreview(entry.id) : previewEntry(entry.id, entry.file)}
                          className="btn-ghost text-[11px] px-2 py-1 flex items-center gap-1"
                          title={previewOpen ? 'Hide preview' : 'Preview transactions'}
                        >
                          {previewOpen ? <EyeOff size={12} /> : <Eye size={12} />}
                          {previewOpen ? 'Hide' : 'Preview'}
                        </button>
                      )}

                      {/* Upload / confirm */}
                      {isPending && !isActive && (
                        <button
                          onClick={() => uploadEntry(entry.id, entry.file)}
                          className="btn-primary text-[11px] px-2.5 py-1 flex items-center gap-1"
                        >
                          <ArrowRight size={12} /> Save
                        </button>
                      )}

                      {/* Retry */}
                      {isFailed && (
                        <button
                          onClick={() => uploadEntry(entry.id, entry.file)}
                          className="btn-ghost text-[11px] px-2 py-1 flex items-center gap-1 text-brand-600 dark:text-brand-400"
                        >
                          <RefreshCw size={11} /> Retry
                        </button>
                      )}

                      {/* Remove */}
                      {(isDone || isFailed || isPending) && !isActive && (
                        <button
                          onClick={() => removeEntry(entry.id)}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                          aria-label={`Remove ${entry.file.name}`}
                        >
                          <X size={13} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline preview panel */}
                  {previewOpen && entry.previewData && (
                    <PreviewPanel data={entry.previewData} />
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
