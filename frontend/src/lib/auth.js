import { createAuthClient } from '@neondatabase/auth'
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters'

// One Neon Auth client for the whole app. Neon Auth runs the accounts:
// email + password and "Continue with Google". The Dishboxd API also requires an
// emailed code for each new login session before granting journal access.
const authUrl = import.meta.env.VITE_NEON_AUTH_URL
if (!authUrl) {
  throw new Error('VITE_NEON_AUTH_URL is missing. Copy frontend/.env.example to frontend/.env.')
}

export const authClient = createAuthClient(authUrl, { adapter: BetterAuthReactAdapter() })

// Neon Auth reports most problems as returned errors, but network failures throw.
// This turns both into { data, error } so the pages only have one case to handle.
export async function authCall(request) {
  try {
    const result = await request()
    return { data: result?.data ?? null, error: result?.error ?? null }
  } catch (error) {
    return { data: null, error }
  }
}

// Plain-language messages for the errors a user can actually fix
const messages = {
  invalid_credentials: 'Wrong email or password.',
  user_already_exists: 'An account with this email already exists. Log in instead.',
  weak_password: 'Use a password between 8 and 128 characters.',
  email_address_invalid: 'Enter a valid email address.',
  over_request_rate_limit: 'Too many tries. Wait a minute and try again.',
  over_email_send_rate_limit: 'Too many emails sent. Wait a minute before asking for another code.',
}

export function isUnverifiedEmail(error) {
  return error?.code === 'email_not_confirmed' || /not verified/i.test(error?.message ?? '')
}

export function authErrorMessage(error) {
  if (!error) return ''
  if (messages[error.code]) return messages[error.code]
  const text = error.message ?? ''
  if (/invalid otp/i.test(text)) return 'That code is not right. Check the email and try again.'
  if (/otp expired/i.test(text)) return 'That code has expired. Send a new one.'
  if (/too many attempts/i.test(text)) return 'Too many wrong codes. Send a new one.'
  if (/failed to fetch|network/i.test(text)) return 'Could not reach the sign-in service. Check your connection.'
  return text || 'Something went wrong. Please try again.'
}

// Simple format check before asking the server (the server checks again)
export function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128
