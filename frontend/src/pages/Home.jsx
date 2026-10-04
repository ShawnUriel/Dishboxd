import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../components/atoms/Button.jsx'
import Photo from '../components/atoms/Photo.jsx'
import PersonCard from '../components/molecules/PersonCard.jsx'
import ReviewCard from '../components/molecules/ReviewCard.jsx'
import { api } from '../lib/api.js'
import { authCall, authClient } from '../lib/auth.js'
import { formatMonth } from '../lib/format.js'
import { averageRating, newestFirst } from '../lib/stats.js'
import { useJournal } from '../state/useJournal.js'

export default function Home() {
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const { visits, restaurants, boxes, shareVisit } = useJournal()
  const [profile, setProfile] = useState(null)
  const [people, setPeople] = useState([])
  const [tab, setTab] = useState('journal')
  const [socialReviews, setSocialReviews] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let active = true
    Promise.all([api('/api/profiles/me'), api('/api/profiles')])
      .then(([me, directory]) => {
        if (active) {
          setProfile(me.profile)
          setPeople(directory.profiles.slice(0, 3))
        }
      })
      .catch((failure) => {
        if (active) setError(failure.message)
      })
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    if (tab === 'journal') return
    const controller = new AbortController()
    api(`/api/profiles/feed?scope=${tab}`, { signal: controller.signal })
      .then((data) => {
        setSocialReviews(data.reviews)
        setLoading(false)
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          setError(failure.message)
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [tab, refresh])
  const byId = new Map(restaurants.map((r) => [r.id, r]))
  const recent = [...visits].sort(newestFirst).slice(0, 10)
  const favourite = restaurants
    .map((r) => ({ ...r, rating: averageRating(visits.filter((v) => v.restaurantId === r.id)) }))
    .sort((a, b) => b.rating - a.rating)[0]
  const dishCount = visits.reduce((count, visit) => count + visit.dishes.length, 0)
  const name = profile?.name || session?.user.name || 'food lover'
  async function logOut() {
    const result = await authCall(() => authClient.signOut())
    if (result.error) {
      setError('Could not log out. Try again.')
      return
    }
    navigate('/login', { replace: true })
  }
  function followed(updated) {
    setPeople((current) => current.map((p) => (p.id === updated.id ? updated : p)))
    if (tab !== 'journal') setLoading(true)
    setRefresh((n) => n + 1)
  }
  function changeTab(value) {
    if (value === tab) return
    setLoading(value !== 'journal')
    setError('')
    setTab(value)
  }
  return (
    <div className="page-enter">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-4 border-b border-dashed border-line pb-5">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            The Log<span className="ml-2 text-brand">.</span>
          </h1>
          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted">
            Dishboxd / {formatMonth()}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/profile" className="flex items-center gap-2 text-xs text-muted">
            <Photo
              id={profile?.avatarId}
              alt="Your profile"
              fallback={name.slice(0, 1)}
              className="size-9 rounded-full"
            />
            <span className="max-w-28 truncate">{name}</span>
          </Link>
          <button type="button" onClick={logOut} className="text-xs text-accent underline underline-offset-4">
            Log out
          </button>
        </div>
      </header>
      <section
        className="paper-card relative grid overflow-hidden bg-sidebar/40 p-6 sm:p-8 lg:grid-cols-[1fr_16rem] lg:gap-8"
        aria-labelledby="welcome-title"
      >
        <div className="relative z-10">
          <p className="mb-4 text-[10px] uppercase tracking-[0.22em] text-brand">
            Your personal table of memories
          </p>
          <h2
            id="welcome-title"
            className="max-w-xl font-serif text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl"
          >
            Good meals.
            <br />
            <span className="text-brand">Better memories.</span>
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-7 text-muted">
            Welcome back, {name.split(' ')[0]}. A favourite dish, a little discovery, a table worth returning
            to. Keep it all here.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link
              to="/log/new"
              className="paper-lift rounded-md bg-brand px-5 py-3 text-xs font-semibold uppercase tracking-wider text-white"
            >
              + New entry
            </Link>
            <Link to="/people" className="text-xs text-accent underline underline-offset-4">
              Find your food people ↗
            </Link>
          </div>
        </div>
        <div aria-hidden="true" className="relative hidden items-center justify-center lg:flex">
          <div className="absolute size-48 rounded-full border border-dashed border-brand/20" />
          <div className="rotate-6 border border-card-edge bg-card px-7 py-6 text-center shadow-md">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted">Filed under</p>
            <p className="my-4 font-serif text-3xl italic text-brand">
              Very good
              <br />
              taste.
            </p>
            <div className="border-t border-dashed border-line pt-3 text-[10px] uppercase tracking-widest text-muted">
              ★ Keep the good ones ★
            </div>
          </div>
        </div>
      </section>
      <div className="stagger my-6 grid grid-cols-3 gap-3 sm:gap-5">
        {[
          [visits.length, 'Meals remembered'],
          [restaurants.length, 'Places on file'],
          [dishCount, 'Dishes tried'],
        ].map(([value, label]) => (
          <div key={label} className="paper-card px-3 py-4 sm:px-5">
            <p className="font-serif text-3xl font-semibold text-brand">{String(value).padStart(2, '0')}</p>
            <p className="mt-2 text-[10px] uppercase tracking-wide text-muted sm:text-xs">{label}</p>
          </div>
        ))}
      </div>
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <section aria-labelledby="journal-title" className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 id="journal-title" className="font-serif text-2xl font-semibold">
              Fresh from the journal
            </h2>
            <div
              className="flex gap-1 rounded-md border border-line bg-card p-1"
              role="group"
              aria-label="Choose a review feed"
            >
              {[
                ['journal', 'Yours'],
                ['following', 'Following'],
                ['discover', 'Discover'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => changeTab(value)}
                  aria-pressed={tab === value}
                  className={`rounded px-3 py-2 text-xs transition-colors ${tab === value ? 'bg-brand text-white' : 'text-muted hover:bg-badge'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-md border border-brand/20 bg-card p-4 text-sm text-brand"
            >
              {error}
              {tab !== 'journal' && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="ml-3"
                  onClick={() => {
                    setLoading(true)
                    setRefresh((n) => n + 1)
                  }}
                >
                  Retry
                </Button>
              )}
            </div>
          )}
          {tab === 'journal' ? (
            recent.length ? (
              <div className="stagger space-y-4">
                {recent.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    restaurant={byId.get(review.restaurantId)}
                    own
                    onShare={shareVisit}
                  />
                ))}
              </div>
            ) : (
              <div className="paper-card px-6 py-10 sm:px-10">
                <span className="inline-block -rotate-3 border-2 border-dashed border-brand/40 px-3 py-1 text-[10px] uppercase tracking-widest text-brand">
                  Ready for your first story
                </span>
                <h3 className="mt-7 font-serif text-3xl font-semibold">
                  An empty page.
                  <br />A world of good food.
                </h3>
                <p className="mt-4 max-w-md text-sm leading-7 text-muted">
                  Your journal starts with you. Write about a meal, add a photo from the day, and save the
                  details you want to remember.
                </p>
                <Link
                  to="/log/new"
                  className="mt-7 inline-block text-sm font-semibold text-accent underline underline-offset-4"
                >
                  Write your first review →
                </Link>
                <div className="mt-8 grid gap-4 border-t border-dashed border-line pt-6 sm:grid-cols-3">
                  {[
                    ['01', 'Pick your place'],
                    ['02', 'Tell the food story'],
                    ['03', 'Keep a little snapshot'],
                  ].map(([number, text]) => (
                    <div key={number}>
                      <p className="text-xs text-brand">{number}</p>
                      <p className="mt-2 text-xs leading-6 text-muted">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : loading ? (
            <p role="status" className="paper-card p-8 text-sm text-muted">
              Gathering stories from the table…
            </p>
          ) : socialReviews.length ? (
            <div className="stagger space-y-4">
              {socialReviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          ) : (
            <div className="paper-card p-8">
              <h3 className="font-serif text-2xl font-semibold">
                {tab === 'following' ? 'Make room at your table.' : 'The next story could be yours.'}
              </h3>
              <p className="mt-3 text-sm leading-7 text-muted">
                {tab === 'following'
                  ? 'Follow diners to see their shared reviews here. Private reviews always stay in their journals.'
                  : 'No shared reviews from other diners yet. Share one of yours from your profile.'}
              </p>
              <Link
                to="/people"
                className="mt-5 inline-block text-sm text-accent underline underline-offset-4"
              >
                Meet other diners →
              </Link>
            </div>
          )}
        </section>
      <aside className="min-w-0 space-y-5">
          <section className="paper-card p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-brand">A little nudge</p>
            <h2 className="mt-3 font-serif text-2xl font-semibold">Your next good bite</h2>
            {favourite ? (
              <>
                <p className="mt-3 text-sm leading-7 text-muted">
                  You gave <span className="text-ink">{favourite.name}</span> an average of ★{' '}
                  {favourite.rating.toFixed(1)}. Another visit, another favourite?
                </p>
                <Link
                  to="/log/new"
                  state={{
                    place: { restaurantId: favourite.id, name: favourite.name, address: favourite.address },
                  }}
                  className="mt-4 inline-block text-xs text-accent underline underline-offset-4"
                >
                  Go back for another bite →
                </Link>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm leading-7 text-muted">
                  Start with a place you already love. Your favourite coffee stop counts, too.
                </p>
                <Link
                  to="/search"
                  className="mt-4 inline-block text-xs text-accent underline underline-offset-4"
                >
                  Find a place to remember →
                </Link>
              </>
            )}
          </section>
          <section aria-labelledby="people-title">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="people-title" className="font-serif text-xl font-semibold">
                Around the table
              </h2>
              <Link to="/people" className="text-xs text-accent underline">
                See all
              </Link>
            </div>
            {people.length ? (
              <div className="space-y-3">
                {people.map((person) => (
                  <PersonCard
                    key={person.id}
                    person={person}
                    currentUserId={session?.user.id}
                    onChange={followed}
                  />
                ))}
              </div>
            ) : (
              <div className="paper-card p-5 text-xs leading-6 text-muted">
                Your food circle starts here.{' '}
                <Link to="/people" className="text-accent underline">
                  Explore the directory.
                </Link>
              </div>
            )}
          </section>
          <Link to="/profile" className="paper-card paper-lift block border-l-4 border-l-accent p-5">
            <p className="text-[10px] uppercase tracking-wider text-accent">Your profile card</p>
            <h2 className="mt-2 font-serif text-xl font-semibold">Make it yours.</h2>
            <p className="mt-2 text-xs leading-6 text-muted">
              A photo, a little bio, and your four best bites.
            </p>
            <span className="mt-3 block text-xs text-accent">Open your profile →</span>
          </Link>
          <Link to="/lists" className="paper-card paper-lift block border-l-4 border-l-tray p-5">
            <p className="text-[10px] uppercase tracking-wider text-muted">The card catalog</p>
            <h2 className="mt-2 font-serif text-xl font-semibold">Good places, neatly filed.</h2>
            <p className="mt-2 text-xs leading-6 text-muted">
              {boxes.length
                ? `${boxes.length} boxes for your favourites and someday visits.`
                : 'Keep date-night spots and coffee corners in their own boxes.'}
            </p>
            <span className="mt-3 block text-xs text-accent">Open your tray →</span>
          </Link>
        </aside>
      </div>
    </div>
  )
}
