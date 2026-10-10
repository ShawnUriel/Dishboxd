const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { createSandbox } = require('./sandbox')
// The real Neon client, loaded before a sandbox swaps in the fake provider below
const { neonEmail } = require('../neon-email')

test('Neon email client: error mapping and the diner IP sent with each call', async () => {
  const realFetch = globalThis.fetch
  const sent = []
  let reply
  globalThis.fetch = async (url, options) => {
    sent.push({ url, headers: options.headers })
    return new Response(JSON.stringify(reply.body), { status: reply.status })
  }
  try {
    const cases = [
      [{ status: 200, body: { success: true } }, { status: 200, data: { success: true } }],
      [{ status: 403, body: { code: 'TOO_MANY_ATTEMPTS' } }, { status: 400, error: 'Too many wrong codes. Request a new code.', dead: true }],
      [{ status: 400, body: { code: 'OTP_EXPIRED' } }, { status: 400, error: 'That code has expired. Request a new code.', dead: true }],
      [{ status: 429, body: { message: 'Too many requests' } }, { status: 429, error: 'Too many attempts. Wait a minute, then request a new code.' }],
      [{ status: 400, body: { code: 'INVALID_OTP' } }, { status: 400, error: 'That code is not right. Check your email and try again.' }],
      [{ status: 500, body: { message: 'internal detail' } }, { status: 503, error: 'Email verification is unavailable. Please try again.' }],
    ]
    for (const [upstream, expected] of cases) {
      reply = upstream
      assert.deepEqual(await neonEmail('email-otp/verify-email', { email: 'a@example.test', otp: '1' }, '203.0.113.7'), expected)
    }
    assert.equal(sent[0].headers['X-Forwarded-For'], '203.0.113.7')
    reply = cases[0][0]
    await neonEmail('email-otp/send-verification-otp', { email: 'a@example.test' })
    assert.equal(sent.at(-1).headers['X-Forwarded-For'], undefined)
  } finally {
    globalThis.fetch = realFetch
  }
})

test('email login: real API, session binding, receipts, rate limits and signup', async (t) => {
  const calls = []
  let providerFailure = false
  let providerVoided = false
  let wrongUser = false
  const codes = new Map()
  const sandbox = await createSandbox({ emailAuth: true, emailProvider: async (path, body, ip) => {
    calls.push({ path, body, ip })
    if (providerFailure) return { status: 503, error: 'Email service unavailable.' }
    if (providerVoided) return { status: 400, error: 'Too many wrong codes. Request a new code.', dead: true }
    if (path.endsWith('send-verification-otp')) {
      codes.set(body.email, '123456')
      return { status: 200, data: { success: true } }
    }
    if (codes.get(body.email) !== body.otp) return { status: 400, error: 'That code is not right.' }
    if (path.endsWith('check-verification-otp')) return { status: 200, data: { success: true } }
    codes.delete(body.email)
    return { status: 200, data: { status: true, user: { id: wrongUser ? sandbox.users[1] : sandbox.users[Number(body.email.match(/diner(\d)/)[1])] } } }
  } })
  t.after(() => sandbox.close())
  const { request, pool, users: [alex, bea, casey], sessions } = sandbox
  const prefix = '/api/auth/email'
  const post = (user, path, body, headers) => request(user, prefix + path, { method: 'POST', body, headers })
  const reset = () => pool.query('DELETE FROM email_login_challenges')
  let cookie

  await t.test('a primary token alone cannot read or write journals, including direct media URLs', async () => {
    assert.equal((await request(null, prefix + '/status')).status, 401)
    for (const route of ['/api/profiles/me', '/api/visits', '/api/media/' + randomUUID(), '/api/notifications']) {
      const result = await request(alex, route)
      assert.equal(result.status, 403)
      assert.equal(result.data.code, 'EMAIL_CODE_REQUIRED')
    }
    assert.equal((await request(alex, '/api/profiles/me', { method: 'PATCH', body: { name: 'No bypass' } })).status, 403)
    assert.equal((await request(alex, prefix + '/status', { headers: { 'X-Auth-Session': sessions[1] } })).status, 401)
    assert.equal((await request(alex, prefix + '/status', { headers: { 'X-Auth-Session': '' } })).status, 401)
  })

  await t.test('email is read from the authenticated account and rapid concurrent sends are limited', async () => {
    const results = await Promise.all([post(alex, '/send', { email: 'attacker@example.test' }), post(alex, '/send')])
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 429])
    assert.equal(calls.length, 1)
    assert.equal(calls[0].body.email, 'diner0@example.test')
    assert.ok(calls[0].ip, "the diner's IP goes to Neon with the call")
    const status = await request(alex, prefix + '/status')
    assert.equal(status.data.verified, false)
    assert.equal(status.data.sent, true)
    assert.ok(status.data.retryAfter > 0)
  })

  await t.test('wrong or malformed codes never issue receipts', async () => {
    for (const otp of ['abc123', '', ['123456'], 123456]) assert.equal((await post(alex, '/verify', { otp })).status, 400)
    const wrong = await post(alex, '/verify', { otp: '000000' })
    assert.equal(wrong.status, 400)
    assert.equal(wrong.headers.get('set-cookie'), null)
    assert.equal((await request(alex, '/api/profiles/me')).status, 403)
  })

  await t.test('valid code opens the journal with an HttpOnly receipt; reload and token refresh keep access', async () => {
    const correct = await post(alex, '/verify', { otp: '123456' })
    assert.equal(correct.status, 200)
    assert.deepEqual(correct.data, { verified: true })
    assert.match(correct.headers.get('set-cookie'), /HttpOnly/)
    assert.match(correct.headers.get('set-cookie'), /SameSite=Lax/)
    cookie = correct.headers.get('set-cookie').split(';')[0]
    const stored = await pool.query('SELECT * FROM email_login_sessions WHERE user_id = $1', [alex])
    assert.equal(stored.rows[0].auth_session_id, sessions[0])
    assert.notEqual(stored.rows[0].token_hash, cookie.split('=')[1])
    for (let i = 0; i < 2; i++) {
      assert.equal((await request(alex, prefix + '/status', { headers: { Cookie: cookie } })).data.verified, true)
      assert.equal((await request(alex, '/api/profiles/me', { headers: { Cookie: cookie } })).status, 200)
    }
    assert.equal((await post(alex, '/verify', { otp: '123456' })).status, 400)
  })

  await t.test('receipts cannot be forged, moved to another account or reused with a new login', async () => {
    assert.equal((await request(bea, '/api/profiles/me', { headers: { Cookie: cookie } })).status, 403)
    const forged = cookie.slice(0, cookie.indexOf('=') + 1) + '0'.repeat(64)
    assert.equal((await request(alex, '/api/profiles/me', { headers: { Cookie: forged } })).status, 403)
    const nextSession = randomUUID()
    await pool.query('INSERT INTO auth_sessions (id, "userId") VALUES ($1, $2)', [nextSession, alex])
    assert.equal((await request(alex, '/api/profiles/me', { headers: { Cookie: cookie, 'X-Auth-Session': nextSession } })).status, 403)
  })

  await t.test('session revocation, receipt expiry, and changed emails require authentication again', async () => {
    await pool.query('UPDATE auth_sessions SET "expiresAt" = now() - interval \'1 second\' WHERE id = $1', [sessions[0]])
    assert.equal((await request(alex, '/api/profiles/me', { headers: { Cookie: cookie } })).status, 401)
    await pool.query('UPDATE auth_sessions SET "expiresAt" = now() + interval \'7 days\' WHERE id = $1', [sessions[0]])
    await pool.query('UPDATE auth_users SET email = $2 WHERE id = $1', [alex, 'changed@example.test'])
    assert.equal((await request(alex, '/api/profiles/me', { headers: { Cookie: cookie } })).status, 403)
    await pool.query('UPDATE auth_users SET email = $2 WHERE id = $1', [alex, 'diner0@example.test'])
    await pool.query('UPDATE email_login_sessions SET expires_at = now() - interval \'1 second\'')
    assert.equal((await request(alex, '/api/profiles/me', { headers: { Cookie: cookie } })).status, 403)
  })

  await t.test('expired codes and three failed attempts (Neon voids a code after three) cannot be bypassed', async () => {
    await reset()
    await post(alex, '/send')
    for (let i = 0; i < 3; i++) assert.equal((await post(alex, '/verify', { otp: '000000' })).status, 400)
    assert.equal((await post(alex, '/verify', { otp: '123456' })).status, 429)
    assert.equal((await request(alex, prefix + '/status')).data.sent, false)
    await reset()
    await post(alex, '/send')
    await pool.query('UPDATE email_login_challenges SET expires_at = now() - interval \'1 second\'')
    assert.equal((await post(alex, '/verify', { otp: '123456' })).status, 400)
  })

  await t.test('a code Neon has voided stops counting as sent, so the page asks for a new one', async () => {
    await reset()
    await post(alex, '/send')
    providerVoided = true
    const voided = await post(alex, '/verify', { otp: '123456' })
    providerVoided = false
    assert.equal(voided.status, 400)
    assert.equal(voided.data.error, 'Too many wrong codes. Request a new code.')
    assert.equal((await request(alex, prefix + '/status')).data.sent, false)
    assert.equal((await post(alex, '/verify', { otp: '123456' })).status, 400)
  })

  await t.test('delivery failure stays blocked, preserves cooldown, and can be retried', async () => {
    await reset(); providerFailure = true
    assert.equal((await post(alex, '/send')).status, 503)
    assert.equal((await request(alex, prefix + '/status')).data.sent, false)
    assert.equal((await post(alex, '/send')).status, 429)
    providerFailure = false
    await pool.query('UPDATE email_login_challenges SET sent_at = now() - interval \'31 seconds\'')
    assert.equal((await post(alex, '/send')).status, 200)
    wrongUser = true
    assert.equal((await post(alex, '/verify', { otp: '123456' })).status, 400)
    wrongUser = false
  })

  await t.test('successful verification is single use even for concurrent requests', async () => {
    await reset(); await post(alex, '/send')
    const results = await Promise.all([post(alex, '/verify', { otp: '123456' }), post(alex, '/verify', { otp: '123456' })])
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 400])
    cookie = results.find((r) => r.status === 200).headers.get('set-cookie').split(';')[0]
    assert.equal((await post(alex, '/logout', undefined, { Cookie: cookie })).status, 200)
    assert.equal((await request(alex, '/api/profiles/me', { headers: { Cookie: cookie } })).status, 403)
  })

  await t.test('signup reuses its email code but cannot bypass the check for existing verified users', async () => {
    assert.equal((await post(null, '/signup-receipt', { email: 'diner0@example.test', otp: '123456' })).status, 409)
    await pool.query('UPDATE auth_users SET "emailVerified" = false WHERE id = $1', [casey])
    codes.set('diner2@example.test', '654321')
    assert.equal((await post(null, '/signup-receipt', { email: 'diner2@example.test', otp: '000000' })).status, 400)
    const receipt = await post(null, '/signup-receipt', { email: 'diner2@example.test', otp: '654321' })
    assert.equal(receipt.status, 200)
    const signupCookie = receipt.headers.get('set-cookie').split(';')[0]
    assert.equal((await request(casey, '/api/profiles/me', { headers: { Cookie: signupCookie } })).status, 401)
    await pool.query('UPDATE auth_users SET "emailVerified" = true WHERE id = $1', [casey])
    assert.equal((await request(casey, '/api/profiles/me', { headers: { Cookie: signupCookie } })).status, 200)
    assert.equal((await pool.query('SELECT auth_session_id FROM email_login_sessions WHERE user_id = $1', [casey])).rows[0].auth_session_id, sessions[2])
  })
})
