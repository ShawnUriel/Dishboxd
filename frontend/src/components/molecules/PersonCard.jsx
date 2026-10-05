import { useState } from 'react'
import { Link } from 'react-router-dom'
import Photo from '../atoms/Photo.jsx'
import Button from '../atoms/Button.jsx'
import { api } from '../../lib/api.js'

export default function PersonCard({ person, currentUserId, onChange }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function follow() {
    setBusy(true)
    setError('')
    try {
      const { profile } = await api(`/api/profiles/${person.id}/follow`, {
        method: person.isFollowing ? 'DELETE' : 'PUT',
      })
      onChange?.(profile)
    } catch (failure) {
      setError(failure.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <article className="paper-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to={`/profile/${person.id}`} className="flex min-w-[10rem] flex-1 items-center gap-3">
          <Photo
            id={person.avatarId}
            alt={`${person.name}'s profile photo`}
            fallback={person.name.slice(0, 1)}
            className="size-12 shrink-0 rounded-full"
          />
          <div className="min-w-0">
            <h3 className="truncate font-serif text-lg font-semibold">{person.name}</h3>
            <p className="truncate text-xs text-muted">@{person.handle}</p>
            {person.isFriend ? (
              <span className="mt-1 inline-block whitespace-nowrap rounded-full bg-box-lavender/50 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink">
                Friends
              </span>
            ) : (
              person.followsYou && (
                <span className="mt-1 inline-block whitespace-nowrap rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
                  Follows you
                </span>
              )
            )}
          </div>
        </Link>
        {person.id !== currentUserId && (
          <Button
            size="sm"
            variant={person.isFollowing ? 'secondary' : 'accent'}
            disabled={busy}
            onClick={follow}
            aria-pressed={person.isFollowing}
          >
            {busy ? '…' : person.isFollowing ? 'Following' : person.followsYou ? 'Follow back' : 'Follow'}
          </Button>
        )}
      </div>
      {person.bio && <p className="mt-3 line-clamp-2 text-xs leading-6 text-muted">{person.bio}</p>}
      <p className="mt-3 text-xs text-muted">
        {person.reviewCount} shared {person.reviewCount === 1 ? 'review' : 'reviews'}
      </p>
      {error && (
        <p role="alert" className="mt-2 text-xs text-brand">
          {error}
        </p>
      )}
    </article>
  )
}
