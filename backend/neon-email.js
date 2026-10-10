// Keep email delivery and code validation with the existing identity provider.
// Never forward upstream tokens, cookies, or arbitrary errors to the browser.
// Every call comes from this one server, so the diner's own IP is passed on: Neon limits these
// endpoints per IP (3 a minute), and without it every diner would share a single limit.
async function neonEmail(path, body, clientIp) {
  let response
  try {
    response = await fetch(`${process.env.NEON_AUTH_URL.replace(/\/$/, '')}/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
        ...(clientIp ? { 'X-Forwarded-For': clientIp } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
      redirect: 'error',
    })
  } catch {
    return { status: 503, error: 'Could not reach the email service. Please try again.' }
  }
  const data = await response.json().catch(() => ({}))
  if (response.ok) return { status: 200, data }
  // A code Neon has voided (too many wrong tries, or expired) never works again: only a new
  // code helps, not waiting. `dead` tells the caller to stop treating it as the pending code.
  if (/TOO_MANY_ATTEMPTS/i.test(data.code || ''))
    return { status: 400, error: 'Too many wrong codes. Request a new code.', dead: true }
  if (/EXPIRED/i.test(data.code || ''))
    return { status: 400, error: 'That code has expired. Request a new code.', dead: true }
  if (response.status === 429 || /RATE_LIMIT|TOO_MANY_REQUESTS/i.test(data.code || ''))
    return { status: 429, error: 'Too many attempts. Wait a minute, then request a new code.' }
  if (/INVALID_OTP/i.test(data.code || ''))
    return { status: 400, error: 'That code is not right. Check your email and try again.' }
  return { status: 503, error: 'Email verification is unavailable. Please try again.' }
}

module.exports = { neonEmail }
