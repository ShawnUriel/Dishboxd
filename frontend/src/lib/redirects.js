// After Google sign-in, Neon returns to the app with a one-time `neon_auth_session_verifier` in
// the address, which its client trades for the session and then removes. Any address saved for a
// later redirect must leave it out: sent back to a used verifier, the client tries to trade it
// again, gets no session, and the journal looks signed out on every reload.
const SIGN_IN_VERIFIER = 'neon_auth_session_verifier'

export function withoutSignInVerifier(path) {
  const url = new URL(path, 'http://dishboxd.invalid')
  url.searchParams.delete(SIGN_IN_VERIFIER)
  return url.pathname + url.search + url.hash
}
