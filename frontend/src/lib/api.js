import { authClient } from './auth.js'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

// The login token (a short-lived JWT) from the current Neon Auth session.
// The Neon Auth package caches it and fetches a fresh one when it expires.
async function loginToken() {
  try {
    const { data } = await authClient.getSession()
    return data?.session?.token ?? null
  } catch {
    return null
  }
}

// Call the Dishboxd API as the logged-in user. Returns the JSON body, or throws an
// ApiError whose message can be shown to the user as-is.
export async function api(path, { method = 'GET', body } = {}) {
  const token = await loginToken()
  if (!token) throw new ApiError('Your session has expired. Log in again.', 401)

  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Could not reach the Dishboxd server. Is the backend running?', 0)
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(data.error || `Request failed (${response.status}).`, response.status)
  return data
}
