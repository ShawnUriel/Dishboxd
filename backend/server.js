require('dotenv').config({ quiet: true })
const express = require('express')
const cors = require('cors')
const { requireUser } = require('./auth')
const { router: restaurantsRouter } = require('./routes/restaurants')
const { router: visitsRouter } = require('./routes/visits')
const { router: boxesRouter } = require('./routes/boxes')
const { router: placesRouter } = require('./routes/places')

const app = express()
const PORT = process.env.PORT || 5000

// Only the Dishboxd website may call the API, not every website (no "*" wildcard)
const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
app.use(cors({ origin: allowedOrigin }))
app.use(express.json({ limit: '20kb' }))

// Test route to prove the server is running and CORS is working
app.get('/api/test', (req, res) => {
  res.json({ message: 'Dishboxd backend is working!' })
})

// Journal routes: every one needs a logged-in user and only sees that user's rows
app.use('/api/restaurants', requireUser, restaurantsRouter)
app.use('/api/visits', requireUser, visitsRouter)
app.use('/api/boxes', requireUser, boxesRouter)
app.use('/api/places', requireUser, placesRouter)

// Unknown routes get a plain 404 instead of Express's default HTML page
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Postgres error codes for data the database itself refused
const BAD_DATA_CODES = new Set(['22P02', '23502', '23514'])

// Turn problems into short JSON answers. The full error is logged on the server,
// but stack traces, SQL and connection details never reach the browser.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'The request body is not valid JSON.' })
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'The request is too large.' })
  }
  if (err.status === 400) {
    return res.status(400).json({ error: err.message })
  }
  if (BAD_DATA_CODES.has(err.code)) {
    return res.status(400).json({ error: 'Some of the data is not valid.' })
  }
  console.error(err)
  res.status(500).json({ error: 'Something went wrong' })
})

// Start listening when run directly (node server.js). Exporting the app lets a host
// like Vercel run it without a long-running server.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

module.exports = app
