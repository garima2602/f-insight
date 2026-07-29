import React from 'react'

const SKELETON_WIDTHS = [72, 55, 85, 60, 78, 50, 68, 62]

function TableSkeleton() {
  return (
    <div className="card">
      <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="animate-pulse space-y-1.5">
          <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-28" />
          <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded w-20" />
        </div>
        <div className="flex gap-2 animate-pulse">
          <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-lg w-44" />
          <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-lg w-36" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full" aria-label="Loading transactions" aria-busy="true">
          <thead>
            <tr className="bg-gray-50/95 dark:bg-gray-900/95 border-b border-gray-100 dark:border-gray-800">
              <th scope="col" className="text-left px-5 py-3 stat-label">Date</th>
              <th scope="col" className="text-left px-4 py-3 stat-label">Narration</th>
              <th scope="col" className="text-left px-4 py-3 stat-label hidden sm:table-cell">Merchant</th>
              <th scope="col" className="text-left px-4 py-3 stat-label hidden md:table-cell">Category</th>
              <th scope="col" className="text-right px-5 py-3 stat-label">Amount</th>
            </tr>
          </thead>
          <tbody className="animate-pulse">
            {SKELETON_WIDTHS.map((w, i) => (
              <tr key={i} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
                <td className="px-5 py-3.5"><div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-20" /></td>
                <td className="px-4 py-3.5"><div className="h-3 bg-gray-100 dark:bg-gray-800 rounded" style={{ width: `${w}%` }} /></td>
                <td className="px-4 py-3.5 hidden sm:table-cell"><div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-24" /></td>
                <td className="px-4 py-3.5 hidden md:table-cell"><div className="h-5 bg-gray-100 dark:bg-gray-800 rounded-full w-16" /></td>
                <td className="px-5 py-3.5 flex justify-end"><div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-20" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default TableSkeleton
