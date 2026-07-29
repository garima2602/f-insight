import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '../pages/LoginPage'
import { UserAuthProvider } from '../contexts/UserAuthContext'

// Mock api module
vi.mock('../api', () => ({
  login: vi.fn(),
  register: vi.fn(),
  getToken: vi.fn(() => null),
  fetchMe: vi.fn(),
}))

import { login, register } from '../api'

function renderLogin() {
  return render(
    <UserAuthProvider>
      <LoginPage />
    </UserAuthProvider>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders sign-in form by default', () => {
    renderLogin()
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('toggles to register mode', async () => {
    renderLogin()
    await userEvent.click(screen.getByRole('button', { name: /register/i }))
    expect(screen.getByRole('heading', { name: /create an account/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument()
  })

  it('submit button is disabled when fields are empty', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled()
  })

  it('calls login with username and password on submit', async () => {
    login.mockResolvedValue({ access_token: 'tok', user_id: 1, username: 'alice', display_name: 'Alice' })
    renderLogin()

    await userEvent.type(screen.getByLabelText(/username/i), 'alice')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(login).toHaveBeenCalledWith('alice', 'secret123')
  })

  it('shows error message on login failure', async () => {
    login.mockRejectedValue(new Error('Incorrect username or password.'))
    renderLogin()

    await userEvent.type(screen.getByLabelText(/username/i), 'alice')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Incorrect username or password.')
    )
  })

  it('rejects short password in register mode', async () => {
    renderLogin()
    await userEvent.click(screen.getByRole('button', { name: /register/i }))

    await userEvent.type(screen.getByLabelText(/username/i), 'bob')
    await userEvent.type(screen.getByLabelText(/password/i), '123')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/at least 6/i)
    )
    expect(register).not.toHaveBeenCalled()
  })

  it('calls register with all fields in register mode', async () => {
    register.mockResolvedValue({ access_token: 'tok', user_id: 2, username: 'bob', display_name: 'Bob' })
    renderLogin()
    await userEvent.click(screen.getByRole('button', { name: /register/i }))

    await userEvent.type(screen.getByLabelText(/username/i), 'bob')
    await userEvent.type(screen.getByLabelText(/display name/i), 'Bob Smith')
    await userEvent.type(screen.getByLabelText(/password/i), 'secure123')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(register).toHaveBeenCalledWith('bob', 'secure123', 'Bob Smith')
  })

  it('toggles password visibility', async () => {
    renderLogin()
    const pwInput = screen.getByLabelText(/password/i)
    expect(pwInput).toHaveAttribute('type', 'password')

    await userEvent.click(screen.getByRole('button', { name: /show password/i }))
    expect(pwInput).toHaveAttribute('type', 'text')

    await userEvent.click(screen.getByRole('button', { name: /hide password/i }))
    expect(pwInput).toHaveAttribute('type', 'password')
  })
})
