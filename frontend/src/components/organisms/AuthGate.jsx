import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { authClient } from '../../lib/auth.js'
import { api } from '../../lib/api.js'
import Button from '../atoms/Button.jsx'
import { JournalProvider } from '../../state/JournalProvider.jsx'
import { SettingsProvider } from '../../state/SettingsProvider.jsx'
import Onboarding from './Onboarding.jsx'

function Loading() {
  return (
    <div className="bg-lined grid min-h-screen place-items-center">
      <p role="status" className="font-mono text-sm uppercase tracking-widest text-muted">
        Opening your journal…
      </p>
    </div>
  )
}

// Journal pages: logged-in users only. Everyone else goes to Log in, then comes back.
// The journal is keyed by user, so switching accounts never shows the last user's entries.
export function RequireAuth() {
  const { data: session, isPending } = authClient.useSession()
  const location = useLocation()

  if (isPending) return <Loading />
  if (!session?.user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return (
    <EmailSessionGate key={session.session.id}><SettingsProvider key={session.user.id}><Onboarding><JournalProvider>
      <Outlet />
    </JournalProvider></Onboarding></SettingsProvider></EmailSessionGate>
  )
}

function EmailSessionGate({ children }) {
  const location = useLocation()
  const [state, setState] = useState({ loading: true })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    const required = () => setState({ verified: false })
    window.addEventListener('dishboxd:email-required', required)
    api('/api/auth/email/status').then((result) => {
      if (active) setState({ verified: result.verified })
    }).catch((error) => {
      if (active) setState({ error: error.message, expired: error.status === 401 })
    })
    return () => { active = false; window.removeEventListener('dishboxd:email-required', required) }
  }, [attempt])
  if (state.loading) return <Loading />
  if (state.expired) return <SessionExpired />
  if (state.error) return <div className="bg-lined grid min-h-screen place-items-center px-6"><div className="paper-card p-6 text-center">
    <p role="alert" className="mb-4 font-mono text-sm">{state.error}</p>
    <Button onClick={() => { setState({ loading: true }); setAttempt((value) => value + 1) }}>Try again</Button>
  </div></div>
  if (!state.verified) return <Navigate to="/verify-login" replace state={{ from: location.pathname + location.search }} />
  return children
}

function SessionExpired() {
  const [error, setError] = useState('Your session has expired. Sign in again to continue.')
  const [busy, setBusy] = useState(false)
  return <div className="bg-lined grid min-h-screen place-items-center px-6"><div className="paper-card p-6 text-center">
    <p role="alert" className="mb-4 font-mono text-sm">{error}</p>
    <Button disabled={busy} onClick={async () => {
      setBusy(true)
      try {
        const result = await authClient.signOut()
        if (result.error) throw new Error('Could not sign out. Check your connection and try again.')
      } catch (err) { setError(err.message) }
      finally { setBusy(false) }
    }}>Back to sign in</Button>
  </div></div>
}

// Log in and Sign up: already-logged-in users skip straight to their journal.
export function GuestOnly() {
  const { data: session, isPending } = authClient.useSession()
  if (isPending) return <Loading />
  if (session?.user) return <Navigate to="/" replace />
  return <Outlet />
}
