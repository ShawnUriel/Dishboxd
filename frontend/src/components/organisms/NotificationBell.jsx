import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BellIcon, CommentIcon, RepostIcon, UserIcon, UsersIcon } from '../atoms/Icon.jsx'
import Photo from '../atoms/Photo.jsx'
import { api } from '../../lib/api.js'
import './notifications.css'

function timestamp(value) {
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(null)
  const [cursor, setCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const root = useRef(null)
  const trigger = useRef(null)
  const closeButton = useRef(null)
  const request = useRef(null)
  const working = useRef(false)
  const mounted = useRef(false)
  const paged = useRef(false)
  const reload = useCallback(() => setRefresh((value) => value + 1), [])

  useEffect(() => {
    mounted.current = true
    const refreshVisible = () => {
      if (document.visibilityState === 'visible' && !working.current) reload()
    }
    const timer = window.setInterval(refreshVisible, 30000)
    window.addEventListener('focus', refreshVisible)
    window.addEventListener('coauthor-changed', refreshVisible)
    document.addEventListener('visibilitychange', refreshVisible)
    return () => {
      mounted.current = false
      clearInterval(timer)
      window.removeEventListener('focus', refreshVisible)
      window.removeEventListener('coauthor-changed', refreshVisible)
      document.removeEventListener('visibilitychange', refreshVisible)
      request.current?.abort()
    }
  }, [reload])

  useEffect(() => {
    const controller = new AbortController()
    request.current = controller
    api('/api/notifications', { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return
        // Background refreshes should not collapse history while someone is reading it.
        setItems((current) => paged.current
          ? [...data.notifications, ...current.filter((item) => data.notifications.length && BigInt(item.id) < BigInt(data.notifications.at(-1).id))]
          : data.notifications)
        setUnread(data.unreadCount)
        if (!paged.current) setCursor(data.nextCursor)
        setError('')
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [refresh])

  useEffect(() => {
    if (!open) return
    closeButton.current?.focus()
    const outside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false)
    }
    const escape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  async function action(work) {
    if (working.current) return
    working.current = true
    request.current?.abort()
    setBusy(true)
    setError('')
    try {
      await work()
    } catch (failure) {
      if (mounted.current) setError(failure.message)
    } finally {
      working.current = false
      if (mounted.current) setBusy(false)
    }
  }

  async function read(item) {
    await action(async () => {
      if (!item.readAt) await api(`/api/notifications/${item.id}/read`, { method: 'PATCH' })
      navigate(item.kind === 'follow' ? `/profile/${item.actor.id}` : `/review/${item.reviewId}${item.commentId ? '#comments' : ''}`)
    })
  }

  return (
    <div ref={root} onBlur={(event) => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false)
    }}>
      <button
        ref={trigger}
        type="button"
        className="notification-trigger"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}${error ? ', could not refresh' : ''}`}
        aria-expanded={open}
        aria-controls="notification-inbox"
        aria-haspopup="dialog"
        onClick={() => {
          if (!open && !working.current) {
            paged.current = false
            reload()
          }
          setOpen(!open)
        }}
      >
        <BellIcon />
        {unread > 0 && <span className="notification-count" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
        {error && !unread && <span className="notification-count" aria-hidden="true">!</span>}
      </button>
      {open && (
        <section id="notification-inbox" role="dialog" aria-labelledby="notification-title" className="notification-panel">
          <div className="flex items-start justify-between gap-3 border-b border-dashed border-line p-5">
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-brand">From your food people</p>
              <h2 id="notification-title" className="mt-1 font-serif text-2xl font-semibold">Notifications</h2>
              <p className="mt-1 text-xs text-muted" role="status">{unread === null ? 'Your table’s latest activity' : unread ? `${unread} unread ${unread === 1 ? 'update' : 'updates'}` : 'You’re all caught up'}</p>
            </div>
            <button ref={closeButton} type="button" className="notification-close" aria-label="Close notifications" onClick={() => {
              setOpen(false)
              trigger.current?.focus()
            }}>×</button>
          </div>
          {error && <div role="alert" className="px-5 py-3 text-xs leading-5 text-brand">
            {error} <button type="button" disabled={busy} className="underline" onClick={reload}>Retry</button>
          </div>}
          {unread > 0 && items.length > 0 && <div className="border-b border-line px-5 py-3 text-right">
            <button type="button" disabled={busy} className="text-xs text-accent underline underline-offset-4 disabled:opacity-50" onClick={() => action(async () => {
              const through = items[0].id
              await api('/api/notifications/read', { method: 'PATCH', body: { through } })
              if (mounted.current) {
                setItems((current) => current.map((item) => BigInt(item.id) <= BigInt(through) ? { ...item, readAt: item.readAt || new Date().toISOString() } : item))
                reload()
              }
            })}>Mark all as read</button>
          </div>}
          <div className="notification-scroll" aria-busy={loading || busy}>
            {loading ? <p role="status" className="p-6 text-sm text-muted">Checking your table…</p> : items.length ? (
              <ul>
                {items.map((item) => <li key={item.id}>
                  <button type="button" disabled={busy} onClick={() => read(item)} className={`notification-item ${item.readAt ? '' : 'notification-item-unread'}`}>
                    <span className="relative shrink-0">
                      <Photo id={item.actor.avatarId} alt="" fallback={item.actor.name.slice(0, 1)} className="size-10 rounded-full" />
                      <span className="notification-kind">{item.kind === 'follow' ? <UserIcon /> : item.kind === 'coauthor_invite' ? <UsersIcon /> : ['comment', 'reply'].includes(item.kind) ? <CommentIcon /> : <RepostIcon />}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs leading-5"><strong>{item.actor.name}</strong>{item.kind === 'follow' ? ' started following you.' : item.kind === 'reply' ? ' replied to your comment.' : item.kind === 'coauthor_invite' ? <> invited you to co-author a review{item.restaurantName ? <> of <strong>{item.restaurantName}</strong></> : ''}.</> : <>{item.kind === 'comment' ? ' commented on' : ' reposted'} your review{item.restaurantName ? <> of <strong>{item.restaurantName}</strong></> : ''}.</>}</span>
                      <time className="mt-1 block text-[10px] text-muted" dateTime={item.createdAt}>{timestamp(item.createdAt)}</time>
                    </span>
                    {!item.readAt && <span className="notification-dot"><span className="sr-only">Unread</span></span>}
                  </button>
                </li>)}
              </ul>
            ) : !error && <div className="px-7 py-9 text-center">
              <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-badge text-brand"><BellIcon /></span>
              <p className="font-serif text-xl">A seat for every update.</p>
              <p className="mt-2 text-xs leading-6 text-muted">Invitations, follows, reposts and conversations from your food people will appear here.</p>
            </div>}
            {cursor && <button type="button" disabled={busy} className="w-full border-t border-line p-4 text-xs text-accent underline disabled:opacity-50" onClick={() => action(async () => {
              const data = await api(`/api/notifications?before=${encodeURIComponent(cursor)}`)
              if (!mounted.current) return
              paged.current = true
              setItems((current) => [...current, ...data.notifications.filter((item) => !current.some((entry) => entry.id === item.id))])
              setCursor(data.nextCursor)
              setUnread(data.unreadCount)
            })}>{busy ? 'Loading…' : 'Older notifications'}</button>}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-dashed border-line px-5 py-3 text-[9px] text-muted"><span>Updates every 30 seconds.</span><Link to="/settings/notifications" className="text-accent underline">Notification preferences</Link></div>
        </section>
      )}
    </div>
  )
}
