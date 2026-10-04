const { Pool, types } = require('pg')

// Keep DATE columns as plain "YYYY-MM-DD" strings. By default pg turns them into
// JavaScript Dates at midnight in the server's time zone, which can shift the day.
types.setTypeParser(types.builtins.DATE, (value) => value)

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing. Copy backend/.env.example to backend/.env and add your Neon connection string.')
}

// One shared pool of connections to Neon for the whole server
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 })

// Run several queries as one unit: either all of them are saved, or none are.
async function transaction(work) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

module.exports = { pool, transaction }
