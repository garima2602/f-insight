import React, { useState, useRef, useEffect } from 'react'
import { Download, FileText, Sheet, ChevronDown } from 'lucide-react'

function buildCSV(transactions) {
  const headers = ['Date', 'Narration', 'Merchant', 'Category', 'Type', 'Debit', 'Credit', 'Balance']
  const rows = transactions.map(t => [
    t.date ?? '',
    `"${(t.narration ?? '').replace(/"/g, '""')}"`,
    `"${(t.merchant ?? '').replace(/"/g, '""')}"`,
    t.category ?? '',
    t.transaction_type ?? '',
    t.debit ?? 0,
    t.credit ?? 0,
    t.balance ?? '',
  ])
  return [headers, ...rows].map(r => r.join(',')).join('\n')
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportCSV(transactions) {
  const csv = buildCSV(transactions)
  downloadBlob('﻿' + csv, `finsight_transactions_${today()}.csv`, 'text/csv;charset=utf-8')
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function exportPDF(transactions, overview) {
  const printWindow = window.open('', '_blank', 'width=900,height=700')
  if (!printWindow) { alert('Allow pop-ups to export PDF.'); return }

  const totalIncome   = overview?.total_income   ?? transactions.reduce((s, t) => s + (t.credit ?? 0), 0)
  const totalExpenses = overview?.total_expenses  ?? transactions.reduce((s, t) => s + (t.debit  ?? 0), 0)
  const netSavings    = totalIncome - totalExpenses

  const catMap = {}
  transactions.forEach(t => {
    if (t.transaction_type === 'withdrawal') {
      catMap[t.category] = (catMap[t.category] ?? 0) + (t.debit ?? 0)
    }
  })
  const catRows = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) =>
      `<tr><td>${cat}</td><td style="text-align:right">₹${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>`
    ).join('')

  const txRows = transactions.slice(0, 200).map(t =>
    `<tr>
      <td>${t.date ?? ''}</td>
      <td>${(t.narration ?? '').slice(0, 40)}</td>
      <td>${t.merchant ?? '-'}</td>
      <td>${t.category ?? ''}</td>
      <td style="text-align:right;color:${t.transaction_type === 'deposit' ? '#16a34a' : '#dc2626'}">
        ${t.transaction_type === 'deposit' ? '+' : '−'}₹${((t.credit || t.debit) ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
      </td>
    </tr>`
  ).join('')

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>F-Insight Report - ${today()}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; font-size: 12px; color: #111; padding: 32px; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    .meta { color: #6b7280; font-size: 11px; margin-bottom: 24px; }
    .summary { display: flex; gap: 24px; margin-bottom: 28px; }
    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; flex: 1; }
    .card .label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; margin-bottom: 4px; }
    .card .val { font-size: 20px; font-weight: 700; }
    .income { color: #16a34a; }
    .expense { color: #dc2626; }
    .saving { color: ${netSavings >= 0 ? '#16a34a' : '#dc2626'}; }
    h2 { font-size: 14px; font-weight: 600; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
    th { text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
    td { padding: 5px 8px; border-bottom: 1px solid #f3f4f6; }
    tr:last-child td { border-bottom: none; }
    .footer { margin-top: 24px; font-size: 10px; color: #9ca3af; text-align: center; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <h1>F-Insight Financial Report</h1>
  <p class="meta">Generated ${new Date().toLocaleString('en-IN')} · ${transactions.length} transactions</p>

  <div class="summary">
    <div class="card"><div class="label">Total Income</div><div class="val income">₹${totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div></div>
    <div class="card"><div class="label">Total Expenses</div><div class="val expense">₹${totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div></div>
    <div class="card"><div class="label">Net Savings</div><div class="val saving">₹${Math.abs(netSavings).toLocaleString('en-IN', { minimumFractionDigits: 2 })}${netSavings < 0 ? ' (deficit)' : ''}</div></div>
  </div>

  <h2>Spending by Category</h2>
  <table>
    <thead><tr><th>Category</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${catRows}</tbody>
  </table>

  <h2>Transactions${transactions.length > 200 ? ' (first 200 shown)' : ''}</h2>
  <table>
    <thead><tr><th>Date</th><th>Narration</th><th>Merchant</th><th>Category</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${txRows}</tbody>
  </table>

  <p class="footer">F-Insight · 100% local · data never leaves your device</p>
</body>
</html>`)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => printWindow.print(), 400)
}

export default function ExportButton({ transactions = [], overview = null }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!transactions.length) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="btn-secondary px-3 py-1.5 text-[12px] gap-1.5"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Download size={13} aria-hidden="true" />
        Export
        <ChevronDown size={11} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-44 card shadow-lg z-20 py-1 overflow-hidden">
          <button
            onClick={() => { exportCSV(transactions); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-gray-700 dark:text-gray-300
                       hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
          >
            <Sheet size={14} className="text-brand-500" aria-hidden="true" />
            Export as CSV
          </button>
          <button
            onClick={() => { exportPDF(transactions, overview); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-gray-700 dark:text-gray-300
                       hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
          >
            <FileText size={14} className="text-red-500" aria-hidden="true" />
            Export as PDF
          </button>
        </div>
      )}
    </div>
  )
}
