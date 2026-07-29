import { describe, it, expect, beforeEach } from 'vitest'
import { getToken, setToken, clearToken } from '../api'

describe('token helpers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('getToken returns null when nothing stored', () => {
    expect(getToken()).toBeNull()
  })

  it('setToken stores a token', () => {
    setToken('abc123')
    expect(getToken()).toBe('abc123')
  })

  it('clearToken removes the token', () => {
    setToken('abc123')
    clearToken()
    expect(getToken()).toBeNull()
  })

  it('overwrites an existing token', () => {
    setToken('first')
    setToken('second')
    expect(getToken()).toBe('second')
  })
})
