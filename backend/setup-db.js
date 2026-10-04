// Creates Dishboxd's tables in the database from DATABASE_URL.
// Usage (from the backend folder): npm run db:setup
require('dotenv').config({ quiet: true })
const fs = require('node:fs')
const path = require('node:path')
const { pool, transaction } = require('./db')

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'database_setup.sql'), 'utf8')
  await transaction((client) => client.query(sql))
  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`,
  )
  console.log(`Tables ready: ${rows.map((row) => row.table_name).join(', ')}`)
}

main()
  .catch((error) => {
    console.error(`Database setup failed: ${error.message}`)
    process.exitCode = 1
  })
  .finally(() => pool.end())
