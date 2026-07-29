import React, { useState, useRef, useId, useEffect } from 'react'
import {
  Upload, CheckCircle, AlertCircle, X, FileText, Table2,
  FileSpreadsheet, Eye, ArrowRight, ArrowLeft,
} from 'lucide-react'
import { uploadFile, previewFile } from '../api'

const FORMATS = [
  { label: 'CSV',  icon: Table2,          color: 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950' },
  { label: 'XLSX', icon: FileSpreadsheet, color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950'     },
  { label: 'PDF',  icon: FileText,        color: 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950'         },
]

function fmt(val, type) {
  if (val == null || val === 0) return ''
  return `₹${Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

function useUploadProgress(jobId) {
  const [progress, setProgress] = useState(null)
  useEffect(() => {
    if (!jobId) { setProgress(null); return }
    const ws = new WebSocket(`ws://localhost:8000/ws/upload/${jobId}`)
    ws.onmessage = (e) => {
      try { setProgress(JSON.parse(e.data)) } catch {}
    }
    ws.onerror = () => ws.close()
    return () => ws.close()
  }, [jobId])
  return progress
}

// ── Preview table ─────────────────────────────────────────────────────────────

function PreviewTable({ data, totalParsed, onConfirm, onCancel, uploading, progress }) {
  const shown = data.rows?.length ?? 0
  const total = totalParsed ?? shown

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Summary bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 text-[12px] text-gray-600 dark:text-gray-400">
          <span className="font-semibold text-gray-800 dark:text-gray-100">{total.toLocaleString()} transactions found</span>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span className="text-green-600 dark:text-green-400">{data.deposits} deposits</span>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span className="text-red-500 dark:text-red-400">{data.withdrawals} withdrawals</span>
          {shown < total && (
            <>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <span className="text-amber-600 dark:text-amber-400">showing first {shown}</span>
            </>
          )}
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
          {data.file_type}
        </span>
      </div>

      {/* Scrollable table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                {['Date','Narration','Merchant','Category','Debit','Credit','Balance'].map(h => (
                  <th key={h} className="text-left px-3 py-2 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.rows || []).map((row, i) => (
                <tr key={i} className="border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50/60 dark:hover:bg-gray-800/40">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500 dark:text-gray-400 font-mono">{row.date || '-'}</td>
                  <td className="px-3 py-2 max-w-[220px] truncate text-gray-700 dark:text-gray-200" title={row.narration}>{row.narration}</td>
                  <td className="px-3 py-2 max-w-[120px] truncate text-gray-600 dark:text-gray-300">{row.merchant || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="px-1.5 py-0.5 rounded text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{row.category}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-red-500 dark:text-red-400 font-medium">{fmt(row.debit)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-green-600 dark:text-green-400 font-medium">{fmt(row.credit)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500 dark:text-gray-400 font-mono">{fmt(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          onClick={onCancel}
          disabled={uploading}
          className="btn-ghost flex items-center gap-1.5 px-3 py-2 text-sm"
        >
          <ArrowLeft size={13} /> Choose different file
        </button>
        <button
          onClick={onConfirm}
          disabled={uploading}
          className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
        >
          {uploading
            ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> {progress?.message || 'Saving…'}</>
            : <><ArrowRight size={13} /> Confirm &amp; Save</>
          }
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

function FileUpload({ onUploadSuccess, compact = false }) {
  const [stage, setStage]       = useState('idle')   // idle | previewing | previewed | uploading | done | error
  const [pendingFile, setPendingFile] = useState(null)
  const [previewData, setPreviewData] = useState(null)
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState(null)
  const [jobId, setJobId]       = useState(null)
  const progress = useUploadProgress(jobId)
  const fileRef  = useRef(null)
  const inputId  = useId()
  const statusId = useId()
  const [dragOver, setDragOver] = useState(false)

  const reset = () => {
    setStage('idle'); setPendingFile(null); setPreviewData(null)
    setResult(null); setError(null); setJobId(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleFile = async (file) => {
    if (!file) return
    setPendingFile(file)
    setError(null)
    setStage('previewing')
    try {
      const data = await previewFile(file)
      setPreviewData(data)
      setStage('previewed')
    } catch (err) {
      setError(err.message || 'Could not parse this file.')
      setStage('error')
    }
  }

  const handleConfirm = async () => {
    if (!pendingFile) return
    setStage('uploading')
    setError(null)
    try {
      const data = await uploadFile(pendingFile)
      if (data.job_id) setJobId(data.job_id)
      setResult(data)
      setStage('done')
      onUploadSuccess()
    } catch (err) {
      setError(err.message || 'Upload failed.')
      setStage('error')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click() }
  }

  /* ── Compact mode ────────────────────────────────────────────────────────── */
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <label
          htmlFor={inputId}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[12px] font-medium
                      cursor-pointer transition-all duration-150 select-none
                      focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-1
                      ${stage === 'previewing' || stage === 'uploading'
                        ? 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50 dark:hover:border-brand-700 dark:hover:text-brand-400 dark:hover:bg-brand-950'
                      }`}
        >
          <input
            id={inputId} ref={fileRef} type="file" className="sr-only"
            accept=".csv,.xlsx,.xls,.pdf,.ofx,.qfx,.qif,.json"
            aria-label="Upload another bank statement"
            disabled={stage === 'previewing' || stage === 'uploading'}
            onChange={(e) => handleFile(e.target.files[0])}
          />
          {stage === 'previewing' || stage === 'uploading'
            ? <><span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-brand-500 rounded-full animate-spin" /> Processing…</>
            : <><Upload size={13} /> Add another file</>
          }
        </label>
        {stage === 'done' && result && (
          <div role="alert" className="flex items-center gap-1.5 text-[12px] text-brand-600 dark:text-brand-400 font-medium">
            <CheckCircle size={13} />
            {result.filename} · {result.transactions_parsed?.toLocaleString()} txns
            <button onClick={reset} className="ml-1 text-brand-400 hover:text-brand-600" aria-label="Dismiss"><X size={12} /></button>
          </div>
        )}
        {stage === 'error' && (
          <div role="alert" className="flex items-center gap-1.5 text-[12px] text-red-500">
            <AlertCircle size={13} />{error}
            <button onClick={reset} className="ml-1 text-red-400 hover:text-red-600" aria-label="Dismiss"><X size={12} /></button>
          </div>
        )}
      </div>
    )
  }

  /* ── Full card mode ──────────────────────────────────────────────────────── */
  return (
    <section className="card" aria-labelledby="upload-heading">
      <div className="card-header flex items-start justify-between gap-4">
        <div>
          <h2 id="upload-heading" className="section-title">Upload Bank Statement</h2>
          <p className="meta-text mt-0.5">Parsed locally. Your data never leaves this device</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5" aria-label="Supported formats">
          {FORMATS.map(({ label, icon: Icon, color }) => (
            <span key={label} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${color}`}>
              <Icon size={10} aria-hidden="true" />{label}
            </span>
          ))}
        </div>
      </div>

      <div className="card-body space-y-3">

        {/* Drop zone — hidden once a file is picked */}
        {(stage === 'idle' || stage === 'done') && (
          <label
            htmlFor={inputId}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false) }}
            onDrop={handleDrop}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="button"
            aria-describedby={statusId}
            className={`flex flex-col items-center gap-3 border-2 border-dashed rounded-xl
                        px-6 py-8 sm:py-10 text-center cursor-pointer select-none
                        transition-all duration-150 outline-none
                        focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2
                        ${dragOver
                          ? 'border-brand-400 dark:border-brand-500 bg-brand-50 dark:bg-brand-950 scale-[1.01]'
                          : 'border-gray-200 dark:border-gray-700 hover:border-brand-300 hover:bg-gray-50/60 dark:hover:border-brand-700 dark:hover:bg-gray-800/60'
                        }`}
          >
            <input
              id={inputId} ref={fileRef} type="file" className="sr-only"
              accept=".csv,.xlsx,.xls,.pdf,.ofx,.qfx,.qif,.json"
              aria-label="Choose a bank statement file"
              onChange={(e) => { handleFile(e.target.files[0]); e.target.value = '' }}
            />
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${dragOver ? 'bg-brand-100 dark:bg-brand-900' : 'bg-gray-100 dark:bg-gray-800'}`} aria-hidden="true">
              <Upload size={20} className={dragOver ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500'} />
            </div>
            <div id={statusId}>
              <p className="text-[13px] text-gray-600 dark:text-gray-300">
                Drop your file here, or <span className="text-brand-600 dark:text-brand-400 font-semibold">browse</span>
              </p>
              <p className="meta-text mt-1">Up to 50 MB · Preview before saving</p>
            </div>
          </label>
        )}

        {/* Parsing spinner */}
        {stage === 'previewing' && (
          <div className="flex flex-col items-center gap-3 py-8 animate-fade-in">
            <span className="w-8 h-8 border-2 border-gray-200 dark:border-gray-700 border-t-brand-500 rounded-full animate-spin" />
            <p className="text-[13px] text-gray-600 dark:text-gray-300 font-medium">Reading {pendingFile?.name}…</p>
            <p className="meta-text">Parsing locally, nothing is saved yet</p>
          </div>
        )}

        {/* Preview table */}
        {stage === 'previewed' && previewData && (
          <PreviewTable
            data={previewData}
            totalParsed={previewData.total_parsed}
            onConfirm={handleConfirm}
            onCancel={reset}
            uploading={false}
            progress={null}
          />
        )}

        {/* Uploading (saving) */}
        {stage === 'uploading' && previewData && (
          <PreviewTable
            data={previewData}
            totalParsed={previewData.total_parsed}
            onConfirm={() => {}}
            onCancel={() => {}}
            uploading={true}
            progress={progress}
          />
        )}

        {/* Success */}
        {stage === 'done' && result && (
          <div role="alert" aria-live="polite"
            className="flex items-start gap-3 bg-brand-50 dark:bg-brand-950 border border-brand-200 dark:border-brand-800 rounded-lg p-3.5 animate-fade-in">
            <CheckCircle size={15} className="text-brand-600 dark:text-brand-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-brand-800 dark:text-brand-300 truncate">{result.filename}</p>
              <p className="meta-text text-brand-600 dark:text-brand-400 mt-0.5">
                {result.transactions_parsed?.toLocaleString()} transactions saved · {result.deposits} deposits · {result.withdrawals} withdrawals
              </p>
            </div>
            <button onClick={reset} className="text-brand-400 hover:text-brand-600 dark:text-brand-500 dark:hover:text-brand-300 p-0.5 rounded" aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Error */}
        {stage === 'error' && (
          <div role="alert" aria-live="assertive"
            className="flex items-start gap-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3.5 animate-fade-in">
            <AlertCircle size={15} className="text-red-500 dark:text-red-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-red-700 dark:text-red-400">Failed</p>
              <p className="meta-text text-red-500 dark:text-red-400 mt-0.5">{error}</p>
            </div>
            <button onClick={reset} className="text-red-400 hover:text-red-600 p-0.5 rounded" aria-label="Dismiss"><X size={14} /></button>
          </div>
        )}

      </div>
    </section>
  )
}

export default FileUpload
