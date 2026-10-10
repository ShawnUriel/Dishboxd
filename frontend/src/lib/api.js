import { authClient } from './auth.js'

// Where the Express API runs. On Vercel it shares the site's address (everything under /api
// goes to the backend), so production builds call it with relative paths like /api/visits.
// In development it runs on its own port.
const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:5000' : '')

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

// The login token (a short-lived JWT) from the current Neon Auth session.
// The Neon Auth package caches it and fetches a fresh one when it expires.
async function loginSession() {
  try {
    const { data } = await authClient.getSession()
    return data?.session ?? null
  } catch {
    return null
  }
}

// Call the Dishboxd API as the logged-in user. Returns the JSON body, or throws an
// ApiError whose message can be shown to the user as-is.
export async function api(path, { method = 'GET', body, signal, binary = false, anonymous = false } = {}) {
  const session = anonymous ? null : await loginSession()
  if (!anonymous && !session?.token) throw new ApiError('Your session has expired. Log in again.', 401)

  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      credentials: 'include',
      headers: {
        ...(session ? { Authorization: `Bearer ${session.token}`, 'X-Auth-Session': session.id ?? '' } : {}),
        ...(body === undefined
          ? {}
          : { 'Content-Type': body instanceof Blob ? body.type : 'application/json' }),
      },
      body: body === undefined ? undefined : body instanceof Blob ? body : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError('Could not reach the Dishboxd server. Is the backend running?', 0)
  }

  if (binary && response.ok) return response.blob()
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new ApiError(data.error || `Request failed (${response.status}).`, response.status)
    error.code = data.code
    error.retryAfter = data.retryAfter
    if (data.code === 'EMAIL_CODE_REQUIRED') window.dispatchEvent(new Event('dishboxd:email-required'))
    throw error
  }
  return data
}
