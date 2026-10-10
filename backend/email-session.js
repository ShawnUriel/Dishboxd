const { createHash, randomBytes } = require('node:crypto')
const { pool } = require('./db')

const secure = process.env.NODE_ENV === 'production' || process.env.CLIENT_ORIGIN?.startsWith('https://')
const COOKIE = secure ? '__Secure-dishboxd_email' : 'dishboxd_email'
const cookieOptions = { httpOnly: true, secure: Boolean(secure), sameSite: 'lax', path: '/api' }
const digest = (value) => createHash('sha256').update(value).digest('hex')

function proofHash(req) {
  const value = (req.get('cookie') || '').split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1)
  return /^[a-f0-9]{64}$/.test(value || '') ? digest(value) : null
}

async function issueProof(db, userId, email, sessionId, expiresAt) {
  const token = randomBytes(32).toString('hex')
  await db.query('DELETE FROM email_login_sessions WHERE expires_at <= now()')
  await db.query(`INSERT INTO email_login_sessions (token_hash, user_id, email, auth_session_id, expires_at)
    VALUES ($1, $2, $3, $4, $5)`, [digest(token), userId, email, sessionId, expiresAt])
  return token
}

function setProof(res, token) {
  // A session cookie: closing the browser also ends this extra verification.
  res.cookie(COOKIE, token, cookieOptions)
}

async function hasProof(req) {
  const hash = proofHash(req)
  if (!hash) return false
  // A signup code is checked before Neon creates its browser session. Bind that
  // short-lived receipt exactly once, once the verified Neon session is available.
  const { rows } = await pool.query(`UPDATE email_login_sessions
    SET auth_session_id = $3,
        expires_at = CASE WHEN auth_session_id IS NULL THEN LEAST($5, now() + interval '7 days') ELSE expires_at END
    WHERE token_hash = $1 AND user_id = $2 AND email = $4
      AND (auth_session_id = $3 OR auth_session_id IS NULL) AND expires_at > now()
    RETURNING token_hash`, [hash, req.userId, req.authSession.id, req.authSession.email, req.authSession.expiresAt])
  return rows.length > 0
}

async function requireEmail(req, res, next) {
  if (await hasProof(req)) return next()
  res.status(403).json({ code: 'EMAIL_CODE_REQUIRED', error: 'Confirm the code from your email to finish signing in.' })
}

module.exports = { hasProof, issueProof, setProof, proofHash, COOKIE, cookieOptions, requireEmail }
