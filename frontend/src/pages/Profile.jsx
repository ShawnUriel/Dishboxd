import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '../components/atoms/Button.jsx'
import CategoryTag from '../components/atoms/CategoryTag.jsx'
import { StickerIcon } from '../components/atoms/Icon.jsx'
import Photo from '../components/atoms/Photo.jsx'
import TextField from '../components/atoms/TextField.jsx'
import PersonCard from '../components/molecules/PersonCard.jsx'
import ReviewCard from '../components/molecules/ReviewCard.jsx'
import StickerLayer from '../components/molecules/StickerLayer.jsx'
import StickerTray from '../components/molecules/StickerTray.jsx'
import TopPicksEditor from '../components/organisms/TopPicksEditor.jsx'
import { api } from '../lib/api.js'
import { authClient } from '../lib/auth.js'
import { categoryCounts, categoryName } from '../lib/categories.js'
import { preparePhoto } from '../lib/photos.js'
import { mergeReview } from '../lib/reviews.js'
import { useStickerPlacements } from '../lib/useStickerPlacements.js'
import { useJournal } from '../state/useJournal.js'

export default function Profile() {
  const { id } = useParams()
  return <ProfileContent key={id || 'me'} id={id} />
}

const SECTIONS = [
  ['reviews', 'Recent reviews'],
  ['reposts', 'Reposts'],
  ['restaurants', 'Reviewed restaurants'],
  ['followers', 'Followers'],
  ['following', 'Following'],
]

function ProfileContent({ id }) {
  const { data: session } = authClient.useSession()
  const { restaurants: journalRestaurants, visits, shareVisit, updateVisit } = useJournal()
  const own = !id || id === session?.user.id
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [section, setSection] = useState('reviews')
  const [editingPicks, setEditingPicks] = useState(false)
  const [category, setCategory] = useState('')
  const [connections, setConnections] = useState([])
  const [loadingConnections, setLoadingConnections] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const profileId = data?.profile.id
  const followerCount = data?.profile.followerCount
  const followingCount = data?.profile.followingCount
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const target = own ? (await api('/api/profiles/me')).profile.id : id
        const result = await api(`/api/profiles/${target}`)
        if (active) {
          setData(result)
          setError('')
        }
      } catch (failure) {
        if (active) setError(failure.message)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [id, own, attempt])

  useEffect(() => {
    if (!profileId || !['followers', 'following'].includes(section)) return
    let active = true
    api(`/api/profiles/${profileId}/connections?type=${section}`)
      .then((result) => {
        if (active) {
          setConnections(result.profiles)
          setLoadingConnections(false)
        }
      })
      .catch((failure) => {
        if (active) {
          setError(failure.message)
          setLoadingConnections(false)
        }
      })
    return () => {
      active = false
    }
  }, [section, profileId, followerCount, followingCount])

  function showSection(next) {
    if (section === next) return
    setLoadingConnections(['followers', 'following'].includes(next))
    setError('')
    setSection(next)
  }

  async function toggleFollow() {
    setBusy(true)
    setError('')
    try {
      const result = await api(`/api/profiles/${data.profile.id}/follow`, {
        method: data.profile.isFollowing ? 'DELETE' : 'PUT',
      })
      if (['followers', 'following'].includes(section)) setLoadingConnections(true)
      setData((current) => ({ ...current, profile: result.profile }))
    } catch (failure) {
      setError(failure.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveProfile(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await api('/api/profiles/me', { method: 'PATCH', body: draft })
      setData((current) => ({ ...current, profile: result.profile }))
      setEditing(false)
    } catch (failure) {
      setError(failure.message)
    } finally {
      setBusy(false)
    }
  }

  async function uploadAvatar(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const photo = await preparePhoto(file, true)
      const result = await api('/api/media/avatar', { method: 'PUT', body: photo })
      setData((current) => ({ ...current, profile: { ...current.profile, avatarId: result.id } }))
    } catch (failure) {
      setError(failure.message)
    } finally {
      setBusy(false)
    }
  }

  async function changeSharing(visitId, isPublic) {
    await shareVisit(visitId, isPublic)
    setAttempt((n) => n + 1)
  }

  // A like, repost, co-author or sticker change on any card on this page
  function reviewChanged(partial) {
    setData((current) => ({
      ...current,
      reviews: mergeReview(current.reviews, partial),
      reposts: mergeReview(current.reposts ?? [], partial),
    }))
    updateVisit(partial)
  }

  async function saveTopPicks(next) {
    const result = await api('/api/profiles/me/top-picks', { method: 'PUT', body: { picks: next } })
    setData((current) => ({ ...current, topPicks: result.topPicks }))
    setEditingPicks(false)
  }

  function startEditing() {
    setDraft({
      name: data.profile.name,
      handle: data.profile.handle,
      bio: data.profile.bio,
    })
    setEditing(true)
  }

  if (!data)
    return (
      <div className="paper-card mx-auto max-w-3xl p-8">
        {error ? (
          <>
            <p role="alert" className="text-brand">
              {error}
            </p>
            <Button className="mt-4" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </Button>
          </>
        ) : (
          <p role="status">Opening your profile card…</p>
        )}
      </div>
    )
  const { profile, restaurants } = data
  const picks = data.topPicks ?? []
  const byId = new Map(journalRestaurants.map((r) => [r.id, r]))
  const visitsById = new Map(visits.map((visit) => [visit.id, visit]))
  const categories = categoryCounts(restaurants)
  const shownRestaurants = category ? restaurants.filter((r) => categoryName(r) === category) : restaurants

  function reviewCards(reviews, emptyText) {
    if (!reviews.length) {
      return (
        <p className="paper-card p-8 text-sm text-muted">
          {emptyText}
          {own && section === 'reviews' && (
            <Link to="/log/new" className="mt-4 block text-accent underline">
              Write your first review →
            </Link>
          )}
        </p>
      )
    }
    return (
      <div className="stagger grid gap-4 lg:grid-cols-2">
        {reviews.map((review) => {
          // Your own reviews can be changed here; co-reviews and reposts belong to their author
          const authored = own && review.author?.id === profile.id
          return (
            <ReviewCard
              key={review.id}
              review={visitsById.has(review.id) ? { ...review, stickers: visitsById.get(review.id).stickers ?? [] } : review}
              restaurant={authored ? (byId.get(review.restaurantId) ?? review.restaurant) : review.restaurant}
              own={authored}
              showAuthor={!authored}
              currentUserId={session?.user.id}
              onShare={authored ? changeSharing : undefined}
              onChange={reviewChanged}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div className="page-enter mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <span className="text-xs uppercase tracking-[0.18em] text-muted">
          The diner directory / Profile card
        </span>
        <Link to="/friends" className="shrink-0 text-xs text-accent underline underline-offset-4">
          Your friends ↗
        </Link>
      </div>
      <ProfileHeader
        key={profile.id}
        profile={profile}
        stickers={data.stickers ?? []}
        own={own}
        busy={busy}
        onUploadAvatar={uploadAvatar}
        onEdit={startEditing}
        onFollow={toggleFollow}
        onShowSection={showSection}
      />
      {own && <div className="mt-4 flex flex-wrap gap-5 text-xs text-accent"><Link to="/bookmarks" className="underline">Want to try</Link><Link to="/settings/notifications" className="underline">Notification preferences</Link></div>}
      {error && (
        <p role="alert" className="my-4 text-sm text-brand">
          {error}
        </p>
      )}
      {editing && (
        <form onSubmit={saveProfile} className="paper-card mt-6 space-y-5 p-6">
          <h2 className="font-serif text-2xl font-semibold">Make this card yours.</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              id="profile-name"
              label="Display name"
              value={draft.name}
              maxLength={60}
              required
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <TextField
              id="profile-handle"
              label="Username"
              value={draft.handle}
              minLength={3}
              maxLength={30}
              required
              pattern="[a-zA-Z0-9_]+"
              onChange={(e) => setDraft({ ...draft, handle: e.target.value })}
              hint="3–30 letters, numbers or underscores."
            />
          </div>
          <div>
            <label htmlFor="profile-bio" className="text-xs uppercase tracking-wider text-muted">
              Bio
            </label>
            <textarea
              id="profile-bio"
              value={draft.bio}
              maxLength={280}
              rows={3}
              onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
              className="mt-2 w-full rounded-md border border-line bg-paper p-3 text-sm"
            />
            <p className="text-right text-xs text-muted">{draft.bio.length}/280</p>
          </div>
          <div className="flex gap-3">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save profile'}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      <section aria-labelledby="top-picks" className="mt-9">
        <div className="flex items-center gap-4">
          <h2 id="top-picks" className="font-serif text-2xl font-semibold">
            Top picks
          </h2>
          <span className="flex-1 border-t border-dashed border-line" />
          <span className="text-xs uppercase tracking-wider text-muted">The favourites shelf</span>
        </div>
        {own && !editingPicks && (
          <button
            type="button"
            onClick={() => setEditingPicks(true)}
            className="mt-3 text-xs text-accent underline underline-offset-4"
          >
            {picks.length ? 'Edit top picks' : '+ Choose your top picks'}
          </button>
        )}
        {editingPicks ? (
          <TopPicksEditor
            picks={picks}
            restaurants={restaurants}
            visits={visits}
            onSave={saveTopPicks}
            onCancel={() => setEditingPicks(false)}
          />
        ) : picks.length ? (
          // One card per category: "Best in Cafe", the place, and the dish to order there
          <div className="stagger mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {picks.map((pick) => {
              const card = (
                <>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Best in</p>
                  <h3 className="break-words font-serif text-2xl font-semibold leading-tight text-brand">{pick.category}</h3>
                  <Photo
                    id={pick.restaurant.photoId}
                    alt={pick.restaurant.name}
                    fallback="★"
                    className="mt-3 aspect-[4/3] w-full rounded-md"
                  />
                  <p className="mt-3 break-words font-serif text-xl font-semibold leading-snug">{pick.restaurant.name}</p>
                  {pick.dish && (
                    <p className="mt-2 flex items-baseline gap-2 font-mono text-sm">
                      <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted">Dish</span>
                      <span className="leader" aria-hidden="true" />
                      <span className="min-w-0 break-words text-right">{pick.dish}</span>
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted">
                    ★ {pick.restaurant.rating} · {pick.restaurant.reviewCount}{' '}
                    {pick.restaurant.reviewCount === 1 ? 'review' : 'reviews'}
                  </p>
                </>
              )
              return own ? (
                <Link key={pick.category} to={`/restaurant/${pick.restaurant.id}`} className="paper-card paper-lift block p-4">
                  {card}
                </Link>
              ) : (
                <article key={pick.category} className="paper-card paper-lift p-4">
                  {card}
                </article>
              )
            })}
          </div>
        ) : (
          <p className="paper-card mt-5 p-6 text-sm leading-7 text-muted">
            {own
              ? 'Your all-time favourites, one per category: the best cafe, the best ramen, and what to order there.'
              : 'No top picks filed yet.'}
          </p>
        )}
      </section>
      <nav
        aria-label="Profile sections"
        className="mt-9 flex gap-4 overflow-x-auto border-b border-line pb-3"
      >
        {SECTIONS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => showSection(value)}
            aria-current={section === value ? 'page' : undefined}
            className={`shrink-0 text-xs uppercase tracking-wider ${section === value ? 'font-semibold text-brand' : 'text-muted hover:text-brand'}`}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="mt-5">
        {section === 'reviews' && (
          <>
            {own && (
              <p className="mb-4 text-xs leading-6 text-muted">
                Your private reviews are visible only to you. Share a review to add it to your profile and
                other diners’ feeds. Co-reviews you accepted appear here too.
              </p>
            )}
            {reviewCards(
              data.reviews,
              own ? 'Your first review starts with a meal worth remembering.' : 'No shared reviews yet.',
            )}
          </>
        )}
        {section === 'reposts' &&
          reviewCards(
            data.reposts ?? [],
            own
              ? 'Reviews you repost show up here and in your followers’ feeds. Look for ↻ on a shared review.'
              : 'No reposts yet.',
          )}
        {section === 'restaurants' &&
          (restaurants.length ? (
            <>
              {categories.length > 1 && (
                <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter restaurants by category">
                  {[{ name: '', count: restaurants.length }, ...categories].map(({ name, count }) => (
                    <button
                      key={name || 'all'}
                      type="button"
                      aria-pressed={category === name}
                      onClick={() => setCategory(name)}
                      className={`rounded-full border px-3 py-1.5 text-xs ${category === name ? 'border-accent bg-accent text-white' : 'border-line bg-card text-muted hover:border-accent'}`}
                    >
                      {name || 'All'} <span className="opacity-70">{count}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shownRestaurants.map((r) => (
                  <article key={r.id} className="paper-card p-5">
                    <Photo
                      id={r.photoId}
                      alt={r.name}
                      fallback="★"
                      className="mb-4 aspect-[4/3] w-full rounded-md"
                    />
                    <CategoryTag category={r.category} className="mb-2" />
                    <h3 className="font-serif text-2xl font-semibold">{r.name}</h3>
                    <p className="mt-2 text-xs leading-6 text-muted">
                      {r.address || 'An address yet to be filed'}
                    </p>
                    <p className="mt-3 text-xs text-brand">
                      ★ {r.rating} · {r.reviewCount} shared {r.reviewCount === 1 ? 'review' : 'reviews'}
                    </p>
                    <Link
                      to={own ? `/restaurant/${r.id}` : '/log/new'}
                      state={own ? undefined : { place: { name: r.name, address: r.address, category: r.category } }}
                      className="mt-4 inline-block text-xs text-accent underline"
                    >
                      {own ? 'Open your restaurant record →' : 'Try it yourself →'}
                    </Link>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p className="paper-card p-8 text-sm text-muted">
              Restaurants appear here when a review is shared.
            </p>
          ))}
        {['followers', 'following'].includes(section) &&
          (loadingConnections ? (
            <p role="status" className="text-sm text-muted">
              Opening the guest list…
            </p>
          ) : connections.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {connections.map((person) => (
                <PersonCard
                  key={person.id}
                  person={person}
                  currentUserId={session?.user.id}
                  onChange={(updated) => {
                    setConnections((current) => current.map((p) => (p.id === updated.id ? updated : p)))
                    if (own)
                      setData((current) => ({
                        ...current,
                        profile: {
                          ...current.profile,
                          followingCount: current.profile.followingCount + (updated.isFollowing ? 1 : -1),
                        },
                      }))
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="paper-card p-8 text-sm text-muted">
              {section === 'followers'
                ? 'No followers yet. Let your food stories do the talking.'
                : 'No diners followed yet.'}
              <Link to="/friends?tab=find" className="mt-3 block text-accent underline">
                Explore the diner directory →
              </Link>
            </p>
          ))}
      </div>
    </div>
  )
}

// The profile card at the top, with its stickers. On your own card, "Decorate" opens the sticker book.
function ProfileHeader({ profile, stickers: initialStickers, own, busy, onUploadAvatar, onEdit, onFollow, onShowSection }) {
  const [decorating, setDecorating] = useState(false)
  const stickers = useStickerPlacements({ type: 'profile', id: profile.id }, initialStickers)
  return (
    <>
      <header className="paper-card relative isolate overflow-hidden p-6 sm:p-9">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-2 bg-brand" />
        <div className="flex flex-col items-start gap-6 sm:flex-row">
          <div className="shrink-0">
            <div className="-rotate-2 bg-white p-2 shadow-md">
              <Photo
                id={profile.avatarId}
                alt={`${profile.name}'s profile photo`}
                fallback={profile.name.slice(0, 1)}
                className="size-28 rounded-sm sm:size-36"
              />
            </div>
            {own && (
              <label className="mt-3 inline-block cursor-pointer rounded border border-line px-3 py-2 text-xs text-accent focus-within:outline-2 focus-within:outline-brand">
                {busy ? 'Saving…' : 'Upload profile photo'}
                <input
                  aria-label="Upload profile photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={onUploadAvatar}
                  disabled={busy}
                  className="sr-only"
                />
              </label>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.2em] text-accent">
              A table for {profile.name.split(' ')[0]}
            </p>
            <h1 className="mt-3 break-words font-serif text-4xl font-bold tracking-tight sm:text-5xl">
              {profile.name}
            </h1>
            <p className="mt-2 break-all text-sm text-muted">
              @{profile.handle}
              {!own && profile.isFriend && (
                <span className="ml-2 rounded-full bg-box-lavender/50 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink">
                  Friends
                </span>
              )}
              {!own && !profile.isFriend && profile.followsYou && (
                <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wider">
                  Follows you
                </span>
              )}
            </p>
            <p className="mt-4 max-w-xl whitespace-pre-wrap break-words text-sm leading-7">
              {profile.bio ||
                (own
                  ? 'Tell the table a little about yourself. Edit your profile to add a bio.'
                  : 'A food story still being written.')}
            </p>
            <div className="mt-5 flex flex-wrap gap-5 text-sm">
              <span>
                <strong>{profile.reviewCount}</strong> shared{' '}
                {profile.reviewCount === 1 ? 'review' : 'reviews'}
              </span>
              <button type="button" onClick={() => onShowSection('followers')} className="hover:text-brand">
                <strong>{profile.followerCount}</strong> {profile.followerCount === 1 ? 'follower' : 'followers'}
              </button>
              <button type="button" onClick={() => onShowSection('following')} className="hover:text-brand">
                <strong>{profile.followingCount}</strong> following
              </button>
            </div>
          </div>
          {own ? (
            <div className="flex flex-wrap gap-2 sm:flex-col">
              <Button size="sm" variant="secondary" disabled={busy} onClick={onEdit}>
                Edit profile
              </Button>
              <Button
                size="sm"
                variant="secondary"
                aria-expanded={decorating}
                onClick={() => setDecorating(!decorating)}
                className="flex items-center justify-center gap-2"
              >
                <StickerIcon /> {decorating ? 'Done' : 'Decorate'}
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant={profile.isFollowing ? 'secondary' : 'accent'}
              disabled={busy}
              aria-pressed={profile.isFollowing}
              onClick={onFollow}
            >
              {busy ? 'Saving…' : profile.isFollowing ? 'Following' : profile.followsYou ? '+ Follow back' : '+ Follow'}
            </Button>
          )}
        </div>
        <StickerLayer
          placements={stickers.placements}
          size={84}
          editing={own && decorating}
          onUpdate={stickers.update}
          onRemove={stickers.remove}
          label="Stickers on your profile card"
        />
      </header>
      {own && decorating && (
        <div className="mt-4">
          <StickerTray title="Decorate your profile card" onPick={stickers.add} onClose={() => setDecorating(false)} />
        </div>
      )}
      {stickers.error && (
        <p role="alert" className="mt-3 text-sm text-brand">
          {stickers.error}
        </p>
      )}
    </>
  )
}
