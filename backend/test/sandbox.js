// Integration-only harness. The application never imports this module.
// All data lives in a temporary schema; real accounts and journals are untouched.
const { randomUUID, randomBytes } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { Pool, types } = require('pg')
types.setTypeParser(types.builtins.DATE, (value) => value)
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true })

async function createSandbox({ emailAuth = false, emailProvider } = {}) {
  const schema = `dishboxd_test_${randomBytes(8).toString('hex')}`
  const configured = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
  if (!configured)
    throw new Error('Set TEST_DATABASE_URL or configure backend/.env to run integration checks.')
  // A per-connection test search_path requires a direct Neon connection, not PgBouncer.
  const databaseUrl = new URL(configured)
  databaseUrl.hostname = databaseUrl.hostname.replace('-pooler.', '.')
  const connectionString = databaseUrl.toString()
  const admin = new Pool({ connectionString, max: 1 })
  const pool = new Pool({ connectionString, max: 4, options: `-c search_path=${schema},public` })
  const users = [randomUUID(), randomUUID(), randomUUID()]
  const sessions = users.map(() => randomUUID())
  const rewrite = (sql) => sql.replaceAll('neon_auth."user"', `${schema}.auth_users`).replaceAll('neon_auth.session', `${schema}.auth_sessions`)
  let server
  async function close() {
    if (server) await new Promise((resolve) => server.close(resolve))
    await pool.end()
    if (!/^dishboxd_test_[0-9a-f]{16}$/.test(schema))
      throw new Error('Refusing to clean an unexpected schema.')
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
    await admin.end()
  }
  try {
    await admin.query(`CREATE SCHEMA ${schema}`)
    await pool.query(`CREATE TABLE auth_users (id UUID PRIMARY KEY, name TEXT NOT NULL, email TEXT, "emailVerified" BOOLEAN DEFAULT true)`)
    await pool.query(`CREATE TABLE auth_sessions (id UUID PRIMARY KEY, "userId" UUID REFERENCES auth_users(id), "expiresAt" TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days')`)
    await pool.query(rewrite(fs.readFileSync(path.join(__dirname, '../database_setup.sql'), 'utf8')))
    await pool.query('INSERT INTO auth_users (id, name) VALUES ($1, $2), ($3, $4), ($5, $6)', [
      users[0],
      'Alex Rivera',
      users[1],
      'Bea Santos',
      users[2],
      'Casey Cruz',
    ])
    for (let i = 0; i < users.length; i++) {
      await pool.query('UPDATE auth_users SET email = $2 WHERE id = $1', [users[i], `diner${i}@example.test`])
      await pool.query('INSERT INTO auth_sessions (id, "userId") VALUES ($1, $2)', [sessions[i], users[i]])
    }
    const db = {
      pool: { query: (sql, values) => pool.query(rewrite(sql), values) },
      transaction: async (work) => {
        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          const result = await work({ query: (sql, values) => client.query(rewrite(sql), values) })
          await client.query('COMMIT')
          return result
        } catch (error) {
          await client.query('ROLLBACK')
          throw error
        } finally {
          client.release()
        }
      },
    }
    require.cache[require.resolve('../db')] = { exports: db }
    const { loadSession } = require('../auth')
    const emailSession = require('../email-session')
    if (!emailAuth) require.cache[require.resolve('../email-session')] = {
      exports: { ...emailSession, hasProof: async () => true, requireEmail: (req, res, next) => next() },
    }
    if (emailProvider) require.cache[require.resolve('../neon-email')] = { exports: { neonEmail: emailProvider } }
    require.cache[require.resolve('../auth')] = {
      exports: {
        loadSession: emailAuth ? loadSession : (req, res, next) => {
          req.authSession = { id: sessions[users.indexOf(req.userId)], email: `diner${users.indexOf(req.userId)}@example.test`, expiresAt: new Date(Date.now() + 86400000) }
          next()
        },
        requireUser(req, res, next) {
          const id = req.get('authorization')?.replace('Bearer ', '')
          if (!users.includes(id)) return res.status(401).json({ error: 'Log in to continue.' })
          req.userId = id
          next()
        },
      },
    }
    const app = require('../server')
    server = app.listen(0, '127.0.0.1')
    await new Promise((resolve) => server.once('listening', resolve))
    const url = `http://127.0.0.1:${server.address().port}`
    async function request(user, route, { method = 'GET', body, raw, headers = {} } = {}) {
      const response = await fetch(url + route, {
        method,
        headers: {
          ...(user ? { Authorization: `Bearer ${user}` } : {}),
          ...(emailAuth && user ? { 'X-Auth-Session': sessions[users.indexOf(user)] } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : raw ? { 'Content-Type': 'image/jpeg' } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : raw,
      })
      const data = response.headers.get('content-type')?.includes('image/')
        ? Buffer.from(await response.arrayBuffer())
        : await response.json()
      return { status: response.status, data, headers: response.headers }
    }
    return { schema, pool, users, sessions, url, request, close, rewrite }
  } catch (error) {
    await close()
    throw error
  }
}

module.exports = { createSandbox }
