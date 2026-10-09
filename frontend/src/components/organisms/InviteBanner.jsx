import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { UsersIcon } from '../atoms/Icon.jsx'
import { api } from '../../lib/api.js'

export default function InviteBanner() {
  const { pathname } = useLocation()
  const [invites, setInvites] = useState([])
  useEffect(() => {
    let request
    function refresh() {
      if (document.visibilityState === 'hidden') return
      request?.abort()
      request = new AbortController()
      const signal = request.signal
      api('/api/reviews/invites', { signal }).then((data) => {
        if (!signal.aborted) setInvites(data.invites)
      }).catch(() => {})
    }
    refresh()
    const timer = setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    window.addEventListener('coauthor-changed', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      request?.abort()
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('coauthor-changed', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [pathname])
  if (!invites.length) return null
  const first = invites[0]
  return <aside aria-label="Pending co-review invitations" className="mb-6 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-xl border-2 border-brand/30 bg-card p-4 sm:flex sm:flex-wrap sm:p-5">
    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-box-lavender/40 text-brand"><UsersIcon /></span>
    <div className="min-w-0 flex-1" role="status">
      <p className="text-sm font-semibold">{invites.length === 1 ? 'You have a co-review invitation' : `${invites.length} co-review invitations are waiting`}</p>
      <p className="mt-1 text-xs leading-6 text-muted">{first.author?.name} invited you to review {first.restaurant.name} together.</p>
    </div>
    <Link to={`/review/${first.id}`} className="col-span-2 rounded-md bg-brand px-4 py-3 text-center text-xs font-semibold text-white">View invitation</Link>
    {invites.length > 1 && <Link to="/friends" className="col-span-2 text-xs text-accent underline">See all invites</Link>}
  </aside>
}
