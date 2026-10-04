const { createRemoteJWKSet, jwtVerify } = require('jose')

// Neon Auth signs a short-lived token (a JWT) for every logged-in user.
// We check that signature with Neon Auth's public keys, so no passwords ever reach this server.
const NEON_AUTH_URL = process.env.NEON_AUTH_URL
if (!NEON_AUTH_URL) {
  throw new Error('NEON_AUTH_URL is missing. Copy backend/.env.example to backend/.env and add your Neon Auth URL.')
}

// jose downloads the public keys once and caches them
const publicKeys = createRemoteJWKSet(new URL(`${NEON_AUTH_URL}/.well-known/jwks.json`))
// Neon Auth puts its own origin in both the issuer and audience claims
const issuer = new URL(NEON_AUTH_URL).origin

// Middleware for every journal route: rejects the request with 401 unless it carries
// a valid "Authorization: Bearer <token>" header, then sets req.userId for the route.
async function requireUser(req, res, next) {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ')
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Log in to continue.' })
  }

  try {
    const { payload } = await jwtVerify(token, publicKeys, { algorithms: ['EdDSA'], issuer, audience: issuer })
    if (!payload.sub) throw new Error('Token has no user id')
    req.userId = payload.sub
    next()
  } catch {
    res.status(401).json({ error: 'Your session has expired. Log in again.' })
  }
}

module.exports = { requireUser }
