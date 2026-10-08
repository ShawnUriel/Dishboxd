import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { authClient } from '../../lib/auth.js'
import { JournalProvider } from '../../state/JournalProvider.jsx'
import { SettingsProvider } from '../../state/SettingsProvider.jsx'

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
    <SettingsProvider key={session.user.id}><JournalProvider>
      <Outlet />
    </JournalProvider></SettingsProvider>
  )
}

// Log in and Sign up: already-logged-in users skip straight to their journal.
export function GuestOnly() {
  const { data: session, isPending } = authClient.useSession()
  if (isPending) return <Loading />
  if (session?.user) return <Navigate to="/" replace />
  return <Outlet />
}
