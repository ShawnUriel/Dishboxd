const express = require('express')
const { isIP } = require('node:net')
const { pool, transaction } = require('../db')
const { requireUser, loadSession } = require('../auth')
const { neonEmail } = require('../neon-email')
const { hasProof, issueProof, setProof, proofHash, COOKIE, cookieOptions } = require('../email-session')
const router = express.Router()
const retryAfter = (sentAt) => Math.max(0, Math.ceil((new Date(sentAt).getTime() + 30000 - Date.now()) / 1000))
// Neon voids a code after three wrong tries, so a fourth try here could never succeed
const MAX_ATTEMPTS = 3
// The diner's own address for Neon's per-IP limits: Vercel puts it first in X-Forwarded-For
function clientIp(req) {
  const ip = req.get('x-forwarded-for')?.split(',')[0].trim() || req.socket.remoteAddress
  return isIP(ip || '') ? ip : undefined
}

router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next() })

// Reuse the signup verification code, so new users don't receive two emails.
// This endpoint cannot grant a receipt to an already verified account.
router.post('/signup-receipt', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const otp = req.body?.otp
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{4,10}$/.test(otp || ''))
    return res.status(400).json({ error: 'Enter your email and the code from your inbox.' })
  const { rows: [user] } = await pool.query('SELECT id, email, "emailVerified" FROM neon_auth."user" WHERE lower(email) = $1', [email])
  if (!user) return res.status(400).json({ error: 'That code could not be confirmed. Try signing in again.' })
  // Retry after a lost response may already carry the short-lived signup receipt.
  const hash = proofHash(req)
  if (hash) {
    const { rows } = await pool.query(`SELECT 1 FROM email_login_sessions WHERE token_hash = $1
      AND user_id = $2 AND email = $3 AND auth_session_id IS NULL AND expires_at > now()`, [hash, user.id, user.email])
    if (rows.length) return res.json({ success: true })
  }
  if (user.emailVerified) return res.status(409).json({ error: 'Your email is already confirmed. Log in to continue.' })
  const result = await neonEmail('email-otp/check-verification-otp', { email: user.email, otp, type: 'email-verification' }, clientIp(req))
  if (result.status !== 200) return res.status(result.status).json({ error: result.error })
  if (result.data?.success !== true) return res.status(400).json({ error: 'That code could not be confirmed. Try again.' })
  const token = await issueProof(pool, user.id, user.email, null, new Date(Date.now() + 5 * 60000))
  setProof(res, token)
  res.json({ success: true })
})

router.use(requireUser, loadSession)

router.get('/status', async (req, res) => {
  const verified = await hasProof(req)
  const { rows: [challenge] } = await pool.query(`SELECT sent_at, expires_at, consumed_at, attempts
    FROM email_login_challenges WHERE user_id = $1 AND auth_session_id = $2 AND email = $3`,
  [req.userId, req.authSession.id, req.authSession.email])
  const sent = Boolean(challenge && !challenge.consumed_at && challenge.attempts < MAX_ATTEMPTS && new Date(challenge.expires_at) > new Date())
  res.json({ verified, email: req.authSession.email, sent, retryAfter: challenge ? retryAfter(challenge.sent_at) : 0 })
})

router.post('/send', async (req, res) => {
  const outcome = await transaction(async (db) => {
    // Shared database lock makes resend limits hold across tabs and server instances.
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [req.userId])
    const { rows: [previous] } = await db.query('SELECT sent_at FROM email_login_challenges WHERE user_id = $1', [req.userId])
    const wait = previous ? retryAfter(previous.sent_at) : 0
    if (wait) return { status: 429, error: `Wait ${wait} seconds before requesting another code.`, retryAfter: wait }
    // Persist even a failed delivery attempt, preventing rapid retry floods.
    await db.query(`INSERT INTO email_login_challenges (user_id, auth_session_id, email)
      VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET auth_session_id = $2, email = $3,
      sent_at = now(), expires_at = now() + interval '10 minutes', attempts = 0, consumed_at = NULL`,
    [req.userId, req.authSession.id, req.authSession.email])
    const result = await neonEmail('email-otp/send-verification-otp', { email: req.authSession.email, type: 'email-verification' }, clientIp(req))
    if (result.status !== 200 || result.data?.success !== true) {
      await db.query('UPDATE email_login_challenges SET consumed_at = now() WHERE user_id = $1', [req.userId])
      return { status: result.status === 200 ? 503 : result.status, error: result.error || 'Could not send a code. Please try again.', retryAfter: 30 }
    }
    return { status: 200, sent: true, retryAfter: 30 }
  })
  const { status, ...body } = outcome
  res.status(status).json(body)
})

router.post('/verify', async (req, res) => {
  const otp = req.body?.otp
  if (typeof otp !== 'string' || !/^\d{4,10}$/.test(otp)) return res.status(400).json({ error: 'Enter the code from your email (numbers only).' })
  const outcome = await transaction(async (db) => {
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [req.userId])
    const { rows: [challenge] } = await db.query(`SELECT * FROM email_login_challenges
      WHERE user_id = $1 AND auth_session_id = $2 AND email = $3`, [req.userId, req.authSession.id, req.authSession.email])
    if (!challenge || challenge.consumed_at || new Date(challenge.expires_at) <= new Date())
      return { status: 400, error: 'That code has expired or was already used. Request a new code.' }
    if (challenge.attempts >= MAX_ATTEMPTS) return { status: 429, error: 'Too many wrong codes. Request a new code.' }
    await db.query('UPDATE email_login_challenges SET attempts = attempts + 1 WHERE user_id = $1', [req.userId])
    // This endpoint consumes the provider OTP. Checking only in the browser, or
    // using the non-consuming check endpoint here, would allow code replay.
    const result = await neonEmail('email-otp/verify-email', { email: req.authSession.email, otp }, clientIp(req))
    if (process.env.DEBUG_EMAIL_AUTH) { // DEBUG(temp)
      const { rows } = await pool.query('SELECT 1 FROM neon_auth.session WHERE id = $1', [req.authSession.id])
      console.log('[auth debug] verify-email answered', result.status, '| browser session', req.authSession.id.slice(0, 8), rows.length ? 'still exists' : 'GONE right after verify-email')
    }
    if (result.status !== 200) {
      // Neon has voided this code, so stop offering it; the page then asks for a new one
      if (result.dead) await db.query('UPDATE email_login_challenges SET consumed_at = now() WHERE user_id = $1', [req.userId])
      return { status: result.status, error: result.error }
    }
    if (result.data?.status !== true || result.data?.user?.id !== req.userId)
      return { status: 400, error: 'That code could not be confirmed. Request a new code.' }
    await db.query('UPDATE email_login_challenges SET consumed_at = now() WHERE user_id = $1', [req.userId])
    const expiresAt = new Date(Math.min(new Date(req.authSession.expiresAt).getTime(), Date.now() + 7 * 86400000))
    const token = await issueProof(db, req.userId, req.authSession.email, req.authSession.id, expiresAt)
    return { status: 200, token }
  })
  if (outcome.token) { setProof(res, outcome.token); return res.json({ verified: true }) }
  res.status(outcome.status).json({ error: outcome.error })
})

router.post('/logout', async (req, res) => {
  const hash = proofHash(req)
  if (hash) await pool.query('DELETE FROM email_login_sessions WHERE token_hash = $1 AND user_id = $2', [hash, req.userId])
  res.clearCookie(COOKIE, cookieOptions)
  res.json({ success: true })
})

module.exports = { router }
