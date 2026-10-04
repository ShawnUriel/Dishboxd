import { Link, useNavigate } from 'react-router-dom'
import Stamp from '../components/atoms/Stamp.jsx'
import VisitLogFeed from '../components/organisms/VisitLogFeed.jsx'
import { authCall, authClient } from '../lib/auth.js'
import { formatMonth } from '../lib/format.js'
import { newestFirst } from '../lib/stats.js'
import { useJournal } from '../state/useJournal.js'

// "The Log": most recent visits, newest first.
export default function Home() {
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const { visits, restaurants } = useJournal()
  const restaurantsById = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]))
  const recent = [...visits].sort(newestFirst).slice(0, 10)
  const user = session?.user

  async function handleLogOut() {
    await authCall(() => authClient.signOut())
    navigate('/login', { replace: true })
  }

  return (
    <>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl font-bold tracking-tight">The Log</h1>
          <p className="mt-1 font-mono text-sm uppercase tracking-widest text-muted">
            {formatMonth()} — Recent entries
          </p>
          {user && (
            <p className="mt-2 font-mono text-sm text-muted">
              Signed in as <span className="text-ink">{user.name || user.email}</span> ·{' '}
              <button
                type="button"
                onClick={handleLogOut}
                className="text-accent underline hover:text-accent-dark focus-visible:outline-2 focus-visible:outline-accent"
              >
                Log out
              </button>
            </p>
          )}
        </div>
        <Link
          to="/search"
          className="mt-2 shrink-0 rounded-full transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          <Stamp>+ New entry</Stamp>
        </Link>
      </header>

      <div className="mt-6">
        <VisitLogFeed
          visits={recent}
          restaurantsById={restaurantsById}
          emptyMessage="No entries yet. Use + New entry to log your first visit."
        />
      </div>

      <Link
        to="/lists"
        className="mt-16 inline-block font-mono text-sm font-semibold uppercase tracking-widest text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
      >
        View your card catalog boxes <span aria-hidden="true">→</span>
      </Link>
    </>
  )
}
