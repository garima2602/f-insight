import '@testing-library/jest-dom'

// Silence act() warnings in tests
global.IS_REACT_ACT_ENVIRONMENT = true

// localStorage mock
const storage = {}
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (k) => storage[k] ?? null,
    setItem: (k, v) => { storage[k] = String(v) },
    removeItem: (k) => { delete storage[k] },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]) },
  },
})
