// Keeps one user from calling a route too often. Used on Google search, because every
// Google request beyond the free allowance costs money. Counts live in memory, so they
// reset when the server restarts, which is fine for this purpose.
function perUserLimit({ limit, windowMs, message }) {
  const recentCalls = new Map()

  return (req, res, next) => {
    const now = Date.now()
    const calls = (recentCalls.get(req.userId) ?? []).filter((time) => now - time < windowMs)
    if (calls.length >= limit) {
      res.set('Retry-After', String(Math.ceil((windowMs - (now - calls[0])) / 1000)))
      return res.status(429).json({ error: message })
    }
    calls.push(now)
    recentCalls.set(req.userId, calls)
    next()
  }
}

module.exports = { perUserLimit }
