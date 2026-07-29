import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import UserGate from '../components/UserGate'
import { UserAuthContext } from '../contexts/UserAuthContext'

// Expose context for testing — we'll patch UserAuthContext directly
vi.mock('../api', () => ({
  getToken: vi.fn(() => null),
  fetchMe: vi.fn(),
}))

function wrap(contextValue, children) {
  return (
    <UserAuthContext.Provider value={contextValue}>
      {children}
    </UserAuthContext.Provider>
  )
}

describe('UserGate', () => {
  it('shows spinner while loading', () => {
    const { container } = render(
      wrap({ user: null, loading: true, loginSuccess: vi.fn(), logout: vi.fn() },
        <UserGate><div>app</div></UserGate>
      )
    )
    // Spinner div should be present, app should not
    expect(screen.queryByText('app')).not.toBeInTheDocument()
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('renders LoginPage when not authenticated', () => {
    render(
      wrap({ user: null, loading: false, loginSuccess: vi.fn(), logout: vi.fn() },
        <UserGate><div>protected content</div></UserGate>
      )
    )
    expect(screen.queryByText('protected content')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders children when authenticated', () => {
    render(
      wrap(
        { user: { user_id: 1, username: 'alice', display_name: 'Alice' }, loading: false, loginSuccess: vi.fn(), logout: vi.fn() },
        <UserGate><div>protected content</div></UserGate>
      )
    )
    expect(screen.getByText('protected content')).toBeInTheDocument()
  })
})
