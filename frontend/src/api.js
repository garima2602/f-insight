/**
 * API client — all requests go to localhost only.
 */
import axios from 'axios'

const TOKEN_KEY = 'finsight_token'

export function getToken() { return localStorage.getItem(TOKEN_KEY) }
export function setToken(t) { localStorage.setItem(TOKEN_KEY, t) }
export function clearToken() { localStorage.removeItem(TOKEN_KEY) }

const api = axios.create({
  baseURL: '/api',
  timeout: 120000, // 2 min for OCR processing
})

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  return config
})

// ── Response interceptor ──────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // 401 means token expired / invalid — clear it so UI redirects to login
      if (error.response.status === 401) {
        clearToken()
        window.dispatchEvent(new Event('finsight:logout'))
      }
      const detail =
        error.response.data?.detail ||
        error.response.data?.message ||
        `Server error (${error.response.status})`
      return Promise.reject(new Error(detail))
    }
    if (error.request) {
      return Promise.reject(
        new Error('Cannot reach the backend. Make sure the server is running on port 8000.')
      )
    }
    return Promise.reject(new Error(error.message || 'Unknown network error'))
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function register(username, password, displayName = '') {
  const r = await api.post('/auth/register', { username, password, display_name: displayName })
  setToken(r.data.access_token)
  return r.data
}

export async function login(username, password) {
  const r = await api.post('/auth/login', { username, password })
  setToken(r.data.access_token)
  return r.data
}

export async function fetchMe() {
  const r = await api.get('/auth/me')
  return r.data
}

export function logout() {
  clearToken()
  window.dispatchEvent(new Event('finsight:logout'))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fileParams(sourceFile, extra = {}) {
  return { ...(sourceFile ? { source_file: sourceFile } : {}), ...extra }
}

// ── Upload ────────────────────────────────────────────────────────────────────

export async function uploadFile(file) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post('/upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

export async function previewFile(file) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post('/upload/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

export async function getUploadedFiles() {
  const response = await api.get('/upload/files')
  return response.data
}

export async function deleteFile(filename) {
  const response = await api.delete(`/upload/files/${encodeURIComponent(filename)}`)
  return response.data
}

export async function clearData() {
  const response = await api.delete('/upload/')
  return response.data
}

// ── Analytics (all accept an optional sourceFile to scope to one upload) ──────

// dateRange = { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' } | null
function rangeParams(dateRange) {
  if (!dateRange) return {}
  return {
    ...(dateRange.from ? { date_from: dateRange.from } : {}),
    ...(dateRange.to   ? { date_to:   dateRange.to   } : {}),
  }
}

export async function getOverview(sourceFile = null, dateRange = null) {
  const response = await api.get('/analytics/overview', { params: fileParams(sourceFile, rangeParams(dateRange)) })
  return response.data
}

export async function getCategories(sourceFile = null, dateRange = null) {
  const response = await api.get('/analytics/categories', { params: fileParams(sourceFile, rangeParams(dateRange)) })
  return response.data
}

export async function getMonthlyTrends(sourceFile = null, dateRange = null) {
  const response = await api.get('/analytics/monthly', { params: fileParams(sourceFile, rangeParams(dateRange)) })
  return response.data
}

export async function getMerchants(sourceFile = null, dateRange = null) {
  const response = await api.get('/analytics/merchants', { params: fileParams(sourceFile, rangeParams(dateRange)) })
  return response.data
}

export async function getAllMerchantNames() {
  const response = await api.get('/analytics/all-merchants')
  return response.data
}

export async function getBehavioral(sourceFile = null, dateRange = null) {
  const response = await api.get('/analytics/behavioral', { params: fileParams(sourceFile, rangeParams(dateRange)) })
  return response.data
}

export async function getInsights(sourceFile = null, dateRange = null) {
  const response = await api.get('/analytics/insights', { params: fileParams(sourceFile, rangeParams(dateRange)) })
  return response.data
}

export async function getTransactions(sourceFile = null, dateRange = null, page = 1, pageSize = 200) {
  const response = await api.get('/analytics/transactions', {
    params: { ...fileParams(sourceFile, rangeParams(dateRange)), page, page_size: pageSize },
  })
  // Unwrap paginated envelope; callers that just want the array still work
  return response.data?.data ?? response.data
}

export async function getStatementInfo(sourceFile = null) {
  const response = await api.get('/analytics/statement-info', { params: fileParams(sourceFile) })
  return response.data
}

export async function getSubscriptions(sourceFile = null) {
  const response = await api.get('/analytics/subscriptions', { params: fileParams(sourceFile) })
  return response.data
}

export async function getHeatmap(sourceFile = null, dateRange = null) {
  const response = await api.get('/analytics/heatmap', { params: fileParams(sourceFile, rangeParams(dateRange)) })
  const arr = response.data?.data ?? []
  const daily = Object.fromEntries(arr.map(({ date, amount }) => [date, amount]))
  return { daily }
}

export async function getHealthScore(sourceFile = null) {
  const response = await api.get('/analytics/health-score', { params: fileParams(sourceFile) })
  return response.data
}

export async function getAnomalies(sourceFile = null) {
  const response = await api.get('/analytics/anomalies', { params: fileParams(sourceFile) })
  return response.data
}

export async function getForecast(sourceFile = null) {
  const response = await api.get('/analytics/forecast', { params: fileParams(sourceFile) })
  return response.data
}

export async function updateTransactionCategory(transactionId, category) {
  const response = await api.patch(`/analytics/transactions/${transactionId}`, { category })
  return response.data
}

export async function deleteTransaction(transactionId) {
  const response = await api.delete(`/analytics/transactions/${transactionId}`)
  return response.data
}

// ── Settings API ──────────────────────────────────────────────────────────────

export async function getAliases() {
  const r = await api.get('/settings/aliases')
  return r.data
}
export async function createAlias(raw_merchant, alias) {
  const r = await api.post('/settings/aliases', { raw_merchant, alias })
  return r.data
}
export async function deleteAlias(id) {
  const r = await api.delete(`/settings/aliases/${id}`)
  return r.data
}

export async function getCategoryRules() {
  const r = await api.get('/settings/rules')
  return r.data
}
export async function createCategoryRule(keyword, category) {
  const r = await api.post('/settings/rules', { keyword, category })
  return r.data
}
export async function deleteCategoryRule(id) {
  const r = await api.delete(`/settings/rules/${id}`)
  return r.data
}

export async function getAccounts() {
  const r = await api.get('/settings/accounts')
  return r.data
}
export async function renameAccount(id, account_name) {
  const r = await api.patch(`/settings/accounts/${id}`, { account_name })
  return r.data
}

export async function updateProfile(displayName) {
  const r = await api.patch('/auth/me/profile', { display_name: displayName })
  return r.data
}

export async function changePassword(currentPassword, newPassword) {
  const r = await api.post('/auth/me/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  })
  return r.data
}

export async function resetPassword(resetToken, newPassword) {
  const r = await api.post('/auth/reset-password', {
    reset_token: resetToken,
    new_password: newPassword,
  })
  return r.data
}

export async function downloadEncryptedBackup(passphrase) {
  const r = await api.get('/settings/export/encrypted', {
    params: { passphrase },
    responseType: 'blob',
  })
  return r.data
}

export async function importEncryptedBackup(passphrase, file) {
  const formData = new FormData()
  formData.append('file', file)
  const r = await api.post(`/settings/import/encrypted/upload?passphrase=${encodeURIComponent(passphrase)}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return r.data
}

export async function sendChatMessage(message, history = []) {
  const response = await api.post('/chat/', { message, history })
  return response.data
}

/**
 * Streaming chat — calls the SSE endpoint and invokes onChunk for each token.
 * Returns the full assembled reply string when done.
 * Falls back to the standard endpoint if streaming fails.
 */
export async function sendChatMessageStream(message, onChunk) {
  const token = getToken()
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message }),
  })

  if (!response.ok) {
    throw new Error(`Server error (${response.status})`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (raw === '[DONE]') return full
      try {
        const { chunk, error } = JSON.parse(raw)
        if (error) throw new Error(error)
        if (chunk) {
          full += chunk
          onChunk(chunk)
        }
      } catch {
        // ignore malformed SSE lines
      }
    }
  }
  return full
}
