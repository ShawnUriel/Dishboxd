import { useState } from 'react'
import { Link } from 'react-router-dom'
import CoauthorPicker from './CoauthorPicker.jsx'
import { api } from '../../lib/api.js'

// Co-review controls. The author invites one friend, cancels the invite or removes the co-author;
// the invited friend accepts or declines. Changes go to the page through onChange.
export default function CoauthorControls({ review, own, currentUserId, onChange }) {
  const [choosing, setChoosing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const coauthor = review.coauthor
  const invitedMe = coauthor?.id === currentUserId && coauthor?.status === 'pending'

  async function run(request, after) {
    setBusy(true)
    setError('')
    try {
      const result = await request()
      onChange?.(after(result))
      window.dispatchEvent(new Event('coauthor-changed'))
      setChoosing(false)
    } catch (failure) {
      setError(failure.message)
    } finally {
      setBusy(false)
    }
  }
  const route = `/api/reviews/${review.id}/coauthor`
  const invite = (friend) =>
    friend && run(() => api(route, { method: 'PUT', body: { userId: friend.id } }), (result) => result.review)
  const remove = () => run(() => api(route, { method: 'DELETE' }), () => ({ id: review.id, coauthor: null }))
  const accept = () => run(() => api(`${route}/accept`, { method: 'POST' }), (result) => result.review)

  if (invitedMe) {
    return (
      <div className="rounded-lg border border-dashed border-brand/40 bg-brand/5 p-3 text-xs">
        <p className="leading-6">
          <strong className="font-semibold">{review.author?.name}</strong> asked you to co-author this review.
        </p>
        <div className="mt-2 flex gap-2">
          <button type="button" disabled={busy} onClick={accept} className="rounded-md bg-brand px-3 py-1.5 font-semibold uppercase tracking-wider text-white disabled:opacity-50">
            Accept
          </button>
          <button type="button" disabled={busy} onClick={remove} className="rounded-md border border-line bg-card px-3 py-1.5 disabled:opacity-50">
            Decline
          </button>
        </div>
        {error && <p role="alert" className="mt-2 text-brand">{error}</p>}
      </div>
    )
  }
  if (!own) return null

  return (
    <div className="text-xs">
      {coauthor ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
          {coauthor.status === 'pending' ? (
            <>
              Invite sent to{' '}
              <Link to={`/profile/${coauthor.id}`} className="text-ink underline underline-offset-4">
                {coauthor.name}
              </Link>
              <span>· waiting for them to accept</span>
            </>
          ) : (
            <>
              Co-written with{' '}
              <Link to={`/profile/${coauthor.id}`} className="text-ink underline underline-offset-4">
                {coauthor.name}
              </Link>
            </>
          )}
          <button type="button" disabled={busy} onClick={remove} className="text-brand underline underline-offset-4 disabled:opacity-50">
            {coauthor.status === 'pending' ? 'Cancel invite' : 'Remove'}
          </button>
        </p>
      ) : choosing ? (
        <div className="space-y-2">
          <p className="text-muted">Who did you share this meal with? They co-author the review once they accept.</p>
          <CoauthorPicker onSelect={invite} disabled={busy} />
          <button type="button" onClick={() => setChoosing(false)} className="text-muted underline underline-offset-4">
            Never mind
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setChoosing(true)} className="text-accent underline underline-offset-4">
          + Invite a friend to co-author
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-brand">
          {error}
        </p>
      )}
    </div>
  )
}
