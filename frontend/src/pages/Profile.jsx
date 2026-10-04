import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '../components/atoms/Button.jsx'
import Photo from '../components/atoms/Photo.jsx'
import TextField from '../components/atoms/TextField.jsx'
import PersonCard from '../components/molecules/PersonCard.jsx'
import ReviewCard from '../components/molecules/ReviewCard.jsx'
import { api } from '../lib/api.js'
import { authClient } from '../lib/auth.js'
import { preparePhoto } from '../lib/photos.js'
import { newestFirst } from '../lib/stats.js'
import { useJournal } from '../state/useJournal.js'

export default function Profile() {
  const { id } = useParams()
  return <ProfileContent key={id || 'me'} id={id} />
}

function ProfileContent({ id }) {
  const { data: session } = authClient.useSession()
  const { visits, restaurants: journalRestaurants, shareVisit } = useJournal()
  const own = !id || id === session?.user.id
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [section, setSection] = useState('reviews')
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
  const picks = profile.topPickIds.map((pick) => restaurants.find((r) => r.id === pick)).filter(Boolean)
  const reviews = own ? [...visits].sort(newestFirst).slice(0, 20) : data.reviews
  const byId = new Map(journalRestaurants.map((r) => [r.id, r]))
  return (
    <div className="page-enter mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <span className="text-xs uppercase tracking-[0.18em] text-muted">
          The diner directory / Profile card
        </span>
        <Link to="/people" className="shrink-0 text-xs text-accent underline underline-offset-4">
          Find diners ↗
        </Link>
      </div>
      <header className="paper-card relative overflow-hidden p-6 sm:p-9">
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
                  onChange={uploadAvatar}
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
            <p className="mt-2 break-all text-sm text-muted">@{profile.handle}</p>
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
              <button type="button" onClick={() => showSection('followers')} className="hover:text-brand">
                <strong>{profile.followerCount}</strong> {profile.followerCount === 1 ? 'follower' : 'followers'}
              </button>
              <button type="button" onClick={() => showSection('following')} className="hover:text-brand">
                <strong>{profile.followingCount}</strong> following
              </button>
            </div>
          </div>
          {own ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setDraft({
                  name: profile.name,
                  handle: profile.handle,
                  bio: profile.bio,
                  topPickIds: profile.topPickIds.filter((pick) => restaurants.some((r) => r.id === pick)),
                })
                setEditing(true)
              }}
            >
              Edit profile
            </Button>
          ) : (
            <Button
              size="sm"
              variant={profile.isFollowing ? 'secondary' : 'accent'}
              disabled={busy}
              aria-pressed={profile.isFollowing}
              onClick={toggleFollow}
            >
              {busy ? 'Saving…' : profile.isFollowing ? 'Following' : '+ Follow'}
            </Button>
          )}
        </div>
      </header>
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
          <fieldset>
            <legend className="text-xs uppercase tracking-wider text-muted">
              Top picks · choose up to four
            </legend>
            <p className="mt-2 text-xs leading-6 text-muted">
              Share a review first to feature that restaurant here.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {restaurants.map((r) => {
                const selected = draft.topPickIds.includes(r.id)
                return (
                  <label
                    key={r.id}
                    className={`cursor-pointer rounded-md border px-3 py-2 text-sm ${selected ? 'border-brand bg-brand/5 text-brand' : 'border-line'}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={!selected && draft.topPickIds.length >= 4}
                      onChange={() =>
                        setDraft({
                          ...draft,
                          topPickIds: selected
                            ? draft.topPickIds.filter((pick) => pick !== r.id)
                            : [...draft.topPickIds, r.id],
                        })
                      }
                      className="mr-2 accent-brand"
                    />
                    {r.name}
                  </label>
                )
              })}
            </div>
          </fieldset>
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
        {picks.length ? (
          <div className="stagger mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {picks.map((r, index) => (
              <div key={r.id} className="paper-card paper-lift p-3">
                <Photo id={r.photoId} alt={r.name} fallback="★" className="aspect-[4/3] w-full rounded-md" />
                <p className="mt-3 text-xs text-brand">PICK 0{index + 1}</p>
                <h3 className="mt-1 font-serif text-xl font-semibold">{r.name}</h3>
                <p className="mt-2 text-xs text-muted">
                  ★ {r.rating} · {r.reviewCount} {r.reviewCount === 1 ? 'review' : 'reviews'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="paper-card mt-5 p-6 text-sm leading-7 text-muted">
            {own
              ? 'Your best bites belong here. Share a review, then choose your favourites in Edit profile.'
              : 'No top picks filed yet.'}
          </p>
        )}
      </section>
      <nav
        aria-label="Profile sections"
        className="mt-9 flex gap-4 overflow-x-auto border-b border-line pb-3"
      >
        {[
          ['reviews', 'Recent reviews'],
          ['restaurants', 'Reviewed restaurants'],
          ['followers', 'Followers'],
          ['following', 'Following'],
        ].map(([value, label]) => (
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
                other diners’ feeds.
              </p>
            )}
            {reviews.length ? (
              <div className="stagger grid gap-4 lg:grid-cols-2">
                {reviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    restaurant={own ? byId.get(review.restaurantId) : review.restaurant}
                    own={own}
                    onShare={own ? changeSharing : undefined}
                  />
                ))}
              </div>
            ) : (
              <p className="paper-card p-8 text-sm text-muted">
                {own ? 'Your first review starts with a meal worth remembering.' : 'No shared reviews yet.'}
                {own && (
                  <Link to="/log/new" className="mt-4 block text-accent underline">
                    Write your first review →
                  </Link>
                )}
              </p>
            )}
          </>
        )}
        {section === 'restaurants' &&
          (restaurants.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {restaurants.map((r) => (
                <article key={r.id} className="paper-card p-5">
                  <Photo
                    id={r.photoId}
                    alt={r.name}
                    fallback="★"
                    className="mb-4 aspect-[4/3] w-full rounded-md"
                  />
                  <h3 className="font-serif text-2xl font-semibold">{r.name}</h3>
                  <p className="mt-2 text-xs leading-6 text-muted">
                    {r.address || 'An address yet to be filed'}
                  </p>
                  <p className="mt-3 text-xs text-brand">
                    ★ {r.rating} · {r.reviewCount} shared {r.reviewCount === 1 ? 'review' : 'reviews'}
                  </p>
                  <Link
                    to={own ? `/restaurant/${r.id}` : '/log/new'}
                    state={own ? undefined : { place: { name: r.name, address: r.address } }}
                    className="mt-4 inline-block text-xs text-accent underline"
                  >
                    {own ? 'Open your restaurant record →' : 'Try it yourself →'}
                  </Link>
                </article>
              ))}
            </div>
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
              <Link to="/people" className="mt-3 block text-accent underline">
                Explore the diner directory →
              </Link>
            </p>
          ))}
      </div>
    </div>
  )
}
