import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import CategoryTag from '../atoms/CategoryTag.jsx'
import Flames from '../atoms/Flames.jsx'
import { CommentIcon, StickerIcon } from '../atoms/Icon.jsx'
import PrivateBadge from '../atoms/PrivateBadge.jsx'
import Photo from '../atoms/Photo.jsx'
import ScoreBadge from '../atoms/ScoreBadge.jsx'
import StickerImage from '../atoms/StickerImage.jsx'
import CoauthorControls from './CoauthorControls.jsx'
import ReviewActions from './ReviewActions.jsx'
import BookmarkButton from './BookmarkButton.jsx'
import ReviewPhotos from './ReviewPhotos.jsx'
import StickerLayer from './StickerLayer.jsx'
import StickerTray from './StickerTray.jsx'
import { formatDate, formatDateTime, formatMoney } from '../../lib/format.js'
import { fireLevel, hottestScore, isOnFire } from '../../lib/scores.js'
import { visitTotal } from '../../lib/stats.js'
import { useStickerPlacements } from '../../lib/useStickerPlacements.js'
import { useSettings } from '../../state/useSettings.js'

// One review: who wrote it, where, every item with its own score, the notes and photos,
// stickers, and likes / reposts / sharing. Any item past 10 sets the whole card on fire.
// In feeds it is a compact card, the same size for every review: the first few items, the start
// of the notes and a photo strip. Clicking it opens the expanded review with everything, where
// the author can also decorate, share and manage it.
// A preview uses the supplied stickerEditor and never changes a saved review.
// Changes reach the page as a partial review through onChange.
export default function ReviewCard({
  review,
  restaurant = review.restaurant,
  own = false,
  showAuthor = !own,
  currentUserId,
  onShare,
  onChange,
  preview = false,
  expanded = false,
  stickerEditor,
}) {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [decorating, setDecorating] = useState(false)
  const stickers = useStickerPlacements({ type: 'visit', id: review.id }, review.stickers ?? [], (next) =>
    onChange?.({ id: review.id, stickers: next }),
  )
  const level = fireLevel(hottestScore(review))
  const coauthor = review.coauthor?.status === 'accepted' ? review.coauthor : null
  const authors = [review.author, coauthor].filter(Boolean)
  // Who reposted it: you (when you did) first, then the people you follow, newest first
  const otherReposters = (review.reposters ?? (review.repostedBy ? [review.repostedBy] : [])).filter(
    (person) => person.id !== currentUserId,
  )
  const named = otherReposters.slice(0, review.reposted ? 1 : 2)
  const moreReposters = otherReposters.length - named.length
  const isAuthor = own || (currentUserId && review.author?.id === currentUserId)
  const compact = !preview && !expanded
  // Without photos, a compact card has room for more of the ticket
  const hasPhotos = review.photoIds?.length > 0
  const dishes = compact ? review.dishes.slice(0, hasPhotos ? 2 : 4) : review.dishes
  const moreDishes = review.dishes.length - dishes.length
  const canDecorate = expanded && isAuthor && !stickerEditor
  const displayedStickers = stickerEditor?.placements ?? stickers.placements
  const editingStickers = stickerEditor ? stickerEditor.editing : canDecorate && decorating

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
    <div className={`mx-auto w-full min-w-0 ${expanded ? '' : 'max-w-[40rem]'}`}>
      <article onClick={(event) => {
        if (preview || expanded || editingStickers || event.defaultPrevented || event.target.closest('a, button, input, textarea, select, dialog, [role="button"]') || window.getSelection()?.toString()) return
        navigate(`/review/${review.id}`)
      }} className={`paper-card relative isolate mx-auto w-full p-4 sm:p-5 ${compact ? 'review-card-compact flex cursor-pointer flex-col' : ''} ${level > 0 ? 'on-fire' : ''} ${
        compact ? '' : level > 1 ? 'pb-30 sm:pb-30' : level ? 'pb-24 sm:pb-24' : ''}`}>
        {!preview && (review.reposted || named.length > 0) && (
          <p className="mb-3 text-[11px] uppercase tracking-wider text-accent">
            ↻{' '}
            {[
              ...(review.reposted ? [<span key="you">You</span>] : []),
              ...named.map((person) => (
                <Link key={person.id} to={`/profile/${person.id}`} className="underline underline-offset-4">
                  {person.name}
                </Link>
              )),
              ...(moreReposters > 0 ? [<span key="more">{moreReposters} {moreReposters === 1 ? 'other' : 'others'}</span>] : []),
            ].map((part, index, parts) => (
              <span key={index}>
                {index > 0 && (index === parts.length - 1 ? ' and ' : ', ')}
                {part}
              </span>
            ))}{' '}
            reposted
          </p>
        )}
        {!preview && showAuthor && authors.length > 0 && (
          <div className="mb-4 flex items-center gap-3">
            <div className="flex -space-x-2">
              {authors.map((author) => (
                <Link key={author.id} to={`/profile/${author.id}`} className="rounded-full ring-2 ring-card">
                  <Photo
                    id={author.avatarId}
                    alt={`${author.name}'s avatar`}
                    fallback={author.name.slice(0, 1)}
                    className="size-9 rounded-full"
                  />
                </Link>
              ))}
            </div>
            <p className="min-w-0 text-sm">
              {authors.map((author, index) => (
                <span key={author.id}>
                  {index > 0 && <span className="text-muted"> &amp; </span>}
                  <Link to={`/profile/${author.id}`} className="hover:text-brand">
                    {author.name}
                  </Link>
                </span>
              ))}
              <span className="block text-xs text-muted">
                @{review.author?.handle}
                {coauthor && ` · a co-review with @${coauthor.handle}`}
              </span>
              {review.accountPrivate && <span className="mt-2 block"><PrivateBadge /></span>}
            </p>
          </div>
        )}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={`mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-muted ${compact ? 'overflow-hidden whitespace-nowrap' : 'flex-wrap'}`}>
              {formatDate(review.date)}
              <CategoryTag category={restaurant?.category} />
              {review.cuisine && review.cuisine !== restaurant?.category && <CategoryTag category={`${review.cuisine} cuisine`} />}
              {level > 0 && <span className="fire-stamp">On fire</span>}
            </p>
            {compact ? (
              <h3 className="truncate font-serif text-2xl font-semibold">
                <Link to={`/review/${review.id}`} className="hover:text-brand">
                  {restaurant?.name || 'A visit to remember'}
                </Link>
              </h3>
            ) : !preview && own && restaurant ? (
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
            {restaurant?.address && !compact && <p className="mt-1 text-xs text-muted">{restaurant.address}</p>}
            {review.createdAt && (
              <p className={`mt-1 flex gap-x-1.5 text-xs text-muted ${compact ? 'overflow-hidden' : 'flex-wrap'}`}>
                <span className="whitespace-nowrap">
                  Posted <time dateTime={review.createdAt}>{formatDateTime(review.createdAt)}</time>
                </span>{' '}
                {review.editedAt && !compact && (
                  <span className="whitespace-nowrap">
                    · Edited <time dateTime={review.editedAt}>{formatDateTime(review.editedAt)}</time>
                  </span>
                )}
              </p>
            )}
          </div>
          <span
            className="shrink-0 rounded-full border border-brand/25 bg-card px-3 py-2 text-sm font-semibold text-brand"
            aria-label={`${review.rating} out of 5 stars overall`}
          >
            ★ {review.rating}
          </span>
        </div>

        <div className={compact ? 'review-card-trim min-h-0 flex-1 overflow-hidden' : ''}>
        <ul className={`${compact ? 'mt-3' : 'mt-4'} border-y border-dashed border-line`}>
          {dishes.map((dish, index) => (
            <li
              key={dish.id ?? `${dish.name}-${index}`}
              className={`flex items-start gap-3 border-b border-dashed border-line py-2.5 last:border-b-0 ${isOnFire(dish.score) ? 'dish-line-fire' : ''}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 font-mono text-sm">
                  <span className="min-w-0 break-words">{dish.name}</span>
                  <span className="leader" aria-hidden="true" />
                  <span className="shrink-0 text-muted">{formatMoney(dish.price)}</span>
                </div>
                {dish.description && !compact && (
                  <p className="mt-1 break-words text-xs italic leading-5 text-muted">“{dish.description}”</p>
                )}
              </div>
              <ScoreBadge score={dish.score} size="sm" />
              {dish.sticker && (
                <span className="w-9 shrink-0" style={{ transform: `rotate(${dish.sticker.rotation}deg)` }}>
                  <StickerImage id={dish.sticker.stickerId} className="w-full" />
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 flex justify-between font-mono text-xs text-muted">
          <span>
            {review.dishes.length} {review.dishes.length === 1 ? 'item' : 'items'}
            {moreDishes > 0 && ` · +${moreDishes} more`}
          </span>
          <span>Total {formatMoney(visitTotal(review))}</span>
        </p>

        {review.notes && (
          <p className={`mt-3 whitespace-pre-wrap break-words text-sm ${compact ? `leading-6 ${hasPhotos ? 'line-clamp-2' : 'line-clamp-5'}` : 'leading-7'}`}>{review.notes}</p>
        )}
        </div>
        {review.photoIds?.length > 0 && <ReviewPhotos ids={review.photoIds} name={restaurant?.name || 'Dining experience'} expanded={expanded} />}

        {compact && (
          <div className="mt-3 flex shrink-0 flex-wrap items-center gap-2 border-t border-dashed border-line pt-3">
            {review.isPublic && (
              <ReviewActions review={review} canRepost={!isAuthor && review.coauthor?.id !== currentUserId} onChange={onChange} />
            )}
            <Link
              to={`/review/${review.id}#comments`}
              aria-label={`Comments, ${review.commentCount ?? 0}`}
              className="flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-xs text-muted transition-colors hover:border-ink hover:text-ink"
            >
              <CommentIcon />
              <span className="tabular-nums">{review.commentCount ?? 0}</span>
            </Link>
            {isAuthor && !review.isPublic && <span className="ml-auto text-xs text-muted">Only me</span>}
          </div>
        )}
        {expanded && (
          <div className="mt-4 space-y-3 border-t border-dashed border-line pt-3">
            <div className="flex flex-wrap items-center gap-3">
              <Link to={`/review/${review.id}#comments`} className="inline-flex items-center gap-1.5 text-xs text-accent underline"><CommentIcon />Comments ({review.commentCount ?? 0})</Link>
              {isAuthor && <Link to={`/review/${review.id}/edit`} className="text-xs text-accent underline">Edit review</Link>}
              {isAuthor && <Link to={`/review/${review.id}`} className="text-xs text-muted underline">Manage review</Link>}
              {restaurant && <BookmarkButton place={restaurant} restaurantId={restaurant.id} />}
            </div>
            {review.isPublic && (
              <ReviewActions review={review} canRepost={!isAuthor && review.coauthor?.id !== currentUserId} onChange={onChange} />
            )}
            <CoauthorControls review={review} own={own} currentUserId={currentUserId} onChange={onChange} />
            {isAuthor && (
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-muted">{review.isPublic ? (isAuthor ? settings.isPrivate : review.accountPrivate) ? 'Shared with friends' : 'Shared on your profile' : 'Only me'}</span>
                <div className="flex items-center gap-4">
                  {canDecorate && (
                    <button
                      type="button"
                      onClick={() => setDecorating(!decorating)}
                      aria-expanded={decorating}
                      className="flex items-center gap-1.5 text-accent underline underline-offset-4"
                    >
                      <StickerIcon /> {decorating ? 'Done decorating' : displayedStickers.length ? 'Edit stickers' : 'Add stickers'}
                    </button>
                  )}
                  {onShare && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={toggleShare}
                      className="text-accent underline underline-offset-4 disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : review.isPublic ? 'Make private' : 'Share on profile'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        <StickerLayer
          placements={displayedStickers}
          size={58}
          editing={editingStickers}
          onUpdate={stickerEditor?.update ?? (preview ? undefined : stickers.update)}
          onRemove={stickerEditor?.remove ?? (preview ? undefined : stickers.remove)}
          label="Stickers on this review"
        />
        {level > 0 && <Flames level={level} />}
      </article>
      {!preview && (error || stickers.error) && (
        <p role="alert" className="mt-3 text-sm text-brand">
          {error || stickers.error}
        </p>
      )}
      {canDecorate && decorating && (
        <div className="mt-3">
          <StickerTray onPick={stickers.add} onClose={() => setDecorating(false)} />
        </div>
      )}
    </div>
  )
}
