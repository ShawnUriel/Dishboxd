require('dotenv').config({ quiet: true })
const express = require('express')
const cors = require('cors')

// Check the required settings before anything uses them, and log what is wrong. On Vercel a
// crash while the server loads can be retried and then reported as an unrelated Express error
// ("argument handler must be a function"), so the real reason has to reach the log first.
for (const name of ['DATABASE_URL', 'NEON_AUTH_URL']) {
  const value = process.env[name]
  if (!value || !URL.canParse(value)) {
    const problem = `${name} is ${value ? 'not a valid URL (check for quotes or spaces around it)' : 'missing'}. Set it in backend/.env, or in the Vercel project's environment variables.`
    console.error(problem)
    throw new Error(problem)
  }
}

const { requireUser, loadSession } = require('./auth')
const { requireEmail } = require('./email-session')
const { router: emailAuthRouter } = require('./routes/email-auth')
const { router: restaurantsRouter } = require('./routes/restaurants')
const { router: visitsRouter } = require('./routes/visits')
const { router: boxesRouter } = require('./routes/boxes')
const { router: placesRouter } = require('./routes/places')
const { router: profilesRouter } = require('./routes/profiles')
const { router: mediaRouter } = require('./routes/media')
const { router: stickersRouter } = require('./routes/stickers')
const { router: reviewsRouter } = require('./routes/reviews')
const { router: notificationsRouter } = require('./routes/notifications')
const { router: bookmarksRouter } = require('./routes/bookmarks')
const { router: commentsRouter } = require('./routes/comments')
const { router: settingsRouter } = require('./routes/settings')

const app = express()
const PORT = process.env.PORT || 5000

// Only the Dishboxd website may call the API, not every website (no "*" wildcard)
const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
app.use(cors({ origin: allowedOrigin, credentials: true }))
// A ticket with 20 items, each with its own note, fits comfortably in 64 KB
app.use(express.json({ limit: '64kb' }))

// Test route to prove the server is running and CORS is working
app.get('/api/test', (req, res) => {
  res.json({ message: 'Dishboxd backend is working!' })
})

app.use('/api/auth/email', emailAuthRouter)

// Protect every journal endpoint, including direct API calls and media downloads.
app.use('/api', requireUser, loadSession, requireEmail)

// Journal routes: every one needs a logged-in user and only sees that user's rows
app.use('/api/restaurants', restaurantsRouter)
app.use('/api/visits', visitsRouter)
app.use('/api/boxes', boxesRouter)
app.use('/api/places', placesRouter)
app.use('/api/profiles', profilesRouter)
app.use('/api/media', mediaRouter)
app.use('/api/stickers', stickersRouter)
app.use('/api/reviews', reviewsRouter)
app.use('/api/reviews/:id/comments', commentsRouter)
app.use('/api/bookmarks', bookmarksRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/settings', settingsRouter)

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
