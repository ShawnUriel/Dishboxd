import { useState } from 'react'
import { HeartIcon, RepostIcon, ShareIcon } from '../atoms/Icon.jsx'
import { api } from '../../lib/api.js'
import { shareReview } from '../../lib/share.js'

// Like, repost and share for a shared review. Counts change at once and are corrected
// by the server's answer (or put back if saving fails). Likes and reposts save independently,
// and each answer only updates its own pair of fields, so one cannot overwrite the other.
export default function ReviewActions({ review, canRepost, onChange }) {
  const [busy, setBusy] = useState({ like: false, repost: false })
  const [note, setNote] = useState('')

  async function toggle(kind) {
    if (busy[kind]) return
    const [flag, count] = kind === 'like' ? ['liked', 'likeCount'] : ['reposted', 'repostCount']
    const on = review[flag]
    const before = { id: review.id, [flag]: on, [count]: review[count] }
    setNote('')
    setBusy((current) => ({ ...current, [kind]: true }))
    onChange?.({ id: review.id, [flag]: !on, [count]: review[count] + (on ? -1 : 1) })
    try {
      const counts = await api(`/api/reviews/${review.id}/${kind}`, { method: on ? 'DELETE' : 'PUT' })
      onChange?.({ id: review.id, [flag]: counts[flag], [count]: counts[count] })
      if (kind === 'repost' && !on) setNote('Reposted to your followers.')
    } catch (failure) {
      onChange?.(before)
      setNote(failure.message)
    } finally {
      setBusy((current) => ({ ...current, [kind]: false }))
    }
  }

  async function share() {
    setNote('')
    try {
      const result = await shareReview(review)
      if (result === 'copied') setNote('Link copied. It opens for signed-in diners.')
    } catch {
      setNote('Could not copy the link. Open the review and copy its address instead.')
    }
  }

  const base = 'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-60'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => toggle('like')}
        disabled={busy.like}
        aria-pressed={review.liked}
        aria-label={`${review.liked ? 'Unlike' : 'Like'} this review, ${review.likeCount} ${review.likeCount === 1 ? 'like' : 'likes'}`}
        className={`${base} ${review.liked ? 'border-brand/40 bg-[#f3e5e2] text-brand' : 'border-line bg-card text-muted hover:border-brand hover:text-brand'}`}
      >
        <HeartIcon filled={review.liked} />
        <span className="tabular-nums">{review.likeCount}</span>
      </button>
      {canRepost && (
        <button
          type="button"
          onClick={() => toggle('repost')}
          disabled={busy.repost}
          aria-pressed={review.reposted}
          aria-label={`${review.reposted ? 'Undo repost' : 'Repost to your followers'}, ${review.repostCount} ${review.repostCount === 1 ? 'repost' : 'reposts'}`}
          className={`${base} ${review.reposted ? 'border-accent/50 bg-[#e9edf1] text-accent' : 'border-line bg-card text-muted hover:border-accent hover:text-accent'}`}
        >
          <RepostIcon />
          <span className="tabular-nums">{review.repostCount}</span>
        </button>
      )}
      <button type="button" onClick={share} className={`${base} border-line bg-card text-muted hover:border-ink hover:text-ink`}>
        <ShareIcon />
        Share
      </button>
      {note && (
        <span role="status" className="rounded bg-card px-1.5 py-0.5 text-[11px] text-muted">
          {note}
        </span>
      )}
    </div>
  )
}
