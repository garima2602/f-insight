import React, { useState, useEffect } from 'react'
import { X, Minus, Maximize2, FileText } from 'lucide-react'

function ext(filename) {
  return (filename || '').split('.').pop().toLowerCase()
}

function CsvPreview({ filename }) {
  const [rows, setRows]     = useState(null)
  const [error, setError]   = useState(null)

  useEffect(() => {
    fetch(`/api/upload/files/${encodeURIComponent(filename)}/raw`)
      .then(r => r.text())
      .then(text => {
        const lines = text.trim().split('\n').filter(Boolean)
        const parsed = lines.map(line => {
          // Handle quoted CSV fields
          const cols = []
          let cur = '', inQ = false
          for (let i = 0; i < line.length; i++) {
            const ch = line[i]
            if (ch === '"') { inQ = !inQ }
            else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = '' }
            else cur += ch
          }
          cols.push(cur.trim())
          return cols
        })
        setRows(parsed)
      })
      .catch(() => setError('Could not load file.'))
  }, [filename])

  if (error) return <p className="p-6 text-[13px] text-red-500">{error}</p>
  if (!rows)  return <p className="p-6 text-[13px] text-gray-400 animate-pulse">Loading…</p>

  const headers = rows[0] || []
  const data    = rows.slice(1)

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-[12px] border-collapse">
        <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="text-left px-3 py-2 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {h || `Col ${i + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, ri) => (
            <tr key={ri} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/60 dark:hover:bg-gray-800/40">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-1.5 text-gray-700 dark:text-gray-300 whitespace-nowrap max-w-[200px] truncate" title={cell}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PdfPreview({ filename }) {
  const [blobUrl, setBlobUrl] = useState(null)
  const [error, setError]     = useState(null)

  useEffect(() => {
    let objectUrl
    fetch(`/api/upload/files/${encodeURIComponent(filename)}/raw`)
      .then(r => { if (!r.ok) throw new Error(); return r.blob() })
      .then(blob => { objectUrl = URL.createObjectURL(blob); setBlobUrl(objectUrl) })
      .catch(() => setError('Could not load PDF.'))
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [filename])

  if (error)    return <p className="p-6 text-[13px] text-red-500">{error}</p>
  if (!blobUrl) return (
    <div className="flex items-center justify-center h-full gap-2 text-[13px] text-gray-400">
      <span className="w-4 h-4 border-2 border-gray-200 border-t-brand-500 rounded-full animate-spin" />
      Loading PDF…
    </div>
  )
  return <iframe src={blobUrl} title={`Preview: ${filename}`} className="w-full h-full border-0" />
}

function UnsupportedPreview({ filename }) {
  const url = `/api/upload/files/${encodeURIComponent(filename)}/raw`
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <FileText size={24} className="text-gray-400" />
      </div>
      <div>
        <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-200">{filename}</p>
        <p className="meta-text mt-1">This format can't be previewed inline.</p>
      </div>
      <a href={url} download={filename}
        className="btn-primary px-4 py-2 text-sm">
        Download file
      </a>
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export default function FileViewerPanel({ filename, onClose }) {
  const [minimized, setMinimized] = useState(false)
  const fileExt = ext(filename)
  const isPdf = fileExt === 'pdf'
  const isCsv = fileExt === 'csv'

  // Check if the file is available
  const [available, setAvailable] = useState(null)
  useEffect(() => {
    if (!filename) return
    fetch(`/api/upload/files/${encodeURIComponent(filename)}/has-original`)
      .then(r => r.json())
      .then(d => setAvailable(d.available))
      .catch(() => setAvailable(false))
  }, [filename])

  if (!filename) return null

  // ── Minimized bar ─────────────────────────────────────────────────────────
  if (minimized) {
    return (
      <div
        className="fixed bottom-0 right-6 z-40 flex items-center gap-3 px-4 py-2.5
                   bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700
                   rounded-t-xl shadow-xl cursor-pointer select-none
                   hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        onClick={() => setMinimized(false)}
        role="button"
        aria-label={`Restore file viewer for ${filename}`}
      >
        <FileText size={13} className="text-brand-500 shrink-0" />
        <span className="text-[12px] font-medium text-gray-700 dark:text-gray-200 max-w-[180px] truncate">{filename}</span>
        <div className="flex items-center gap-1 ml-1">
          <button
            onClick={e => { e.stopPropagation(); setMinimized(false) }}
            className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            aria-label="Restore"
          >
            <Maximize2 size={11} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onClose() }}
            className="p-1 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400"
            aria-label="Close"
          >
            <X size={11} />
          </button>
        </div>
      </div>
    )
  }

  // ── Full panel ────────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop (subtle) */}
      <div
        className="fixed inset-0 z-30 bg-black/10 dark:bg-black/30"
        onClick={() => setMinimized(true)}
        aria-hidden="true"
      />

      {/* Sliding panel from the right */}
      <div
        className="fixed top-0 right-0 bottom-0 z-40 flex flex-col
                   w-full sm:w-[600px] lg:w-[700px]
                   bg-white dark:bg-gray-900
                   border-l border-gray-200 dark:border-gray-700
                   shadow-2xl animate-slide-in-right"
        role="dialog"
        aria-label={`File preview: ${filename}`}
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <FileText size={14} className="text-brand-500 shrink-0" aria-hidden="true" />
          <span className="flex-1 text-[13px] font-semibold text-gray-800 dark:text-gray-100 truncate">{filename}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMinimized(true)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Minimise"
              title="Minimise"
            >
              <Minus size={13} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
              aria-label="Close"
              title="Close"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {available === null && (
            <p className="p-6 text-[13px] text-gray-400 animate-pulse">Checking file…</p>
          )}
          {available === false && (
            <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
              <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-200">Original file not stored</p>
              <p className="meta-text max-w-xs">
                This file was uploaded before the preview feature was added.
                Delete it and re-upload to enable viewing.
              </p>
            </div>
          )}
          {available === true && isPdf  && <PdfPreview filename={filename} />}
          {available === true && isCsv  && <CsvPreview filename={filename} />}
          {available === true && !isPdf && !isCsv && <UnsupportedPreview filename={filename} />}
        </div>
      </div>
    </>
  )
}
