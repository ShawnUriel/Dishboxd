import { useState } from 'react'
import { Link } from 'react-router-dom'
import Photo from '../atoms/Photo.jsx'
import { formatDate } from '../../lib/format.js'

export default function ReviewCard({ review, restaurant = review.restaurant, own = false, onShare }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function toggleShare() {
    setSaving(true)
    setError('')
    try {
      await onShare(review.id, !review.isPublic)
    } catch (failure) {
      setError(failure.message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <article className="paper-card p-5 sm:p-6">
      {review.author && (
        <Link
          to={`/profile/${review.author.id}`}
          className="mb-4 flex w-fit items-center gap-3 text-sm hover:text-brand"
        >
          <Photo
            id={review.author.avatarId}
            alt={`${review.author.name}'s avatar`}
            fallback={review.author.name.slice(0, 1)}
            className="size-9 rounded-full"
          />
          <span>
            {review.author.name}
            <span className="block text-xs text-muted">@{review.author.handle}</span>
          </span>
        </Link>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 text-xs uppercase tracking-wider text-muted">{formatDate(review.date)}</p>
          {own && restaurant ? (
            <Link
              to={`/restaurant/${restaurant.id}`}
              className="break-words font-serif text-2xl font-semibold hover:text-brand"
            >
              {restaurant.name}
            </Link>
          ) : (
            <h3 className="break-words font-serif text-2xl font-semibold">
              {restaurant?.name || 'A visit to remember'}
            </h3>
          )}
          {restaurant?.address && <p className="mt-1 text-xs text-muted">{restaurant.address}</p>}
        </div>
        <span
          className="shrink-0 rounded-full border border-brand/25 px-3 py-2 text-sm font-semibold text-brand"
          aria-label={`${review.rating} out of 5 stars`}
        >
          ★ {review.rating}
        </span>
      </div>
      <p className="mt-3 text-sm text-muted">{review.dishes.map((d) => d.name).join(' · ')}</p>
      {review.notes && (
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">{review.notes}</p>
      )}
      {review.photoIds?.length > 0 && (
        <div
          className={`mt-4 grid gap-2 ${review.photoIds.length === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3'}`}
        >
          {review.photoIds.map((id, index) => (
            <Photo
              key={id}
              id={id}
              alt={`${restaurant?.name || 'Dining experience'}, photo ${index + 1}`}
              className="aspect-[4/3] w-full rounded-md"
            />
          ))}
        </div>
      )}
      {own && onShare && (
        <div className="mt-4 flex items-center justify-between border-t border-dashed border-line pt-3 text-xs">
          <span className="text-muted">
            {review.isPublic ? 'Shared on your profile' : 'Just for your journal'}
          </span>
          <button
            type="button"
            disabled={saving}
            onClick={toggleShare}
            className="text-accent underline underline-offset-4 disabled:opacity-50"
          >
            {saving ? 'Saving…' : review.isPublic ? 'Make private' : 'Share on profile'}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-brand">
          {error}
        </p>
      )}
    </article>
  )
}
