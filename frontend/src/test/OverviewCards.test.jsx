import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import OverviewCards from '../components/OverviewCards'

const mockData = {
  total_income: 100000,
  total_expenses: 45000,
  net_cashflow: 55000,
  savings_rate: 55,
}

describe('OverviewCards', () => {
  it('shows loading skeletons when loading=true', () => {
    render(<OverviewCards loading={true} data={null} />)
    expect(screen.getByRole('status', { name: /loading overview/i })).toBeInTheDocument()
  })

  it('renders all four cards with data', () => {
    render(<OverviewCards loading={false} data={mockData} />)
    expect(screen.getByText('Total Income')).toBeInTheDocument()
    expect(screen.getByText('Total Expenses')).toBeInTheDocument()
    expect(screen.getByText('Net Cashflow')).toBeInTheDocument()
    expect(screen.getByText('Savings Rate')).toBeInTheDocument()
  })

  it('formats savings rate as percentage', () => {
    render(<OverviewCards loading={false} data={mockData} />)
    expect(screen.getByText('55.0%')).toBeInTheDocument()
  })

  it('renders empty state when data is null and not loading', () => {
    render(<OverviewCards loading={false} data={null} />)
    // Should not crash — renders zeros or empty gracefully
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
