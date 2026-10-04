// Neon Auth signs a short-lived token (a JWT) for every logged-in user.
// We check that signature with Neon Auth's public keys, so no passwords ever reach this server.
const NEON_AUTH_URL = process.env.NEON_AUTH_URL
if (!NEON_AUTH_URL) {
  throw new Error('NEON_AUTH_URL is missing. Copy backend/.env.example to backend/.env and add your Neon Auth URL.')
}

// Neon Auth puts its own origin in both the issuer and audience claims
const issuer = new URL(NEON_AUTH_URL).origin

// jose is published only as an ES module. require() of an ES module depends on Node's own
// module loader, which Vercel replaces, so jose is loaded with import() instead.
// jose downloads the public keys once and caches them.
const verifierReady = import('jose').then(({ createRemoteJWKSet, jwtVerify }) => {
  const publicKeys = createRemoteJWKSet(new URL(`${NEON_AUTH_URL}/.well-known/jwks.json`))
  return (token) => jwtVerify(token, publicKeys, { algorithms: ['EdDSA'], issuer, audience: issuer })
})
// If jose cannot load, say so in the log straight away; requests then get a 500 (see below)
verifierReady.catch((error) => console.error('Could not load jose:', error))

// Middleware for every journal route: rejects the request with 401 unless it carries
// a valid "Authorization: Bearer <token>" header, then sets req.userId for the route.
async function requireUser(req, res, next) {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ')
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Log in to continue.' })
  }

  // Outside the try below: if jose failed to load, that is a server error, not a bad login
  const verify = await verifierReady

  try {
    const { payload } = await verify(token)
    if (!payload.sub) throw new Error('Token has no user id')
    req.userId = payload.sub
    next()
  } catch {
    res.status(401).json({ error: 'Your session has expired. Log in again.' })
  }
}

module.exports = { requireUser }
