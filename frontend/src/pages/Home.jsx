import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../components/atoms/Button.jsx'
import Photo from '../components/atoms/Photo.jsx'
import PersonCard from '../components/molecules/PersonCard.jsx'
import ReviewCard from '../components/molecules/ReviewCard.jsx'
import HomeMemoryCollage from '../components/organisms/HomeMemoryCollage.jsx'
import HomeFoodDesk from '../components/organisms/HomeFoodDesk.jsx'
import HomeTrays from '../components/organisms/HomeTrays.jsx'
import NotificationBell from '../components/organisms/NotificationBell.jsx'
import FoodPassport from '../components/organisms/FoodPassport.jsx'
import HomeStickerCorner from '../components/organisms/HomeStickerCorner.jsx'
import { FolderIcon, PencilIcon, SearchIcon, UsersIcon } from '../components/atoms/Icon.jsx'
import { api } from '../lib/api.js'
import { authCall, authClient } from '../lib/auth.js'
import { categoryCounts } from '../lib/categories.js'
import { formatMonth } from '../lib/format.js'
import { mergeReview } from '../lib/reviews.js'
import { averageRating, newestFirst } from '../lib/stats.js'
import { useJournal } from '../state/useJournal.js'
import './Home.css'
import './HomeKeepsakes.css'
import './HomeScrapbook.css'

export default function Home() {
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const { visits, restaurants, boxes, shareVisit, updateVisit } = useJournal()
  const [profile, setProfile] = useState(null)
  const [people, setPeople] = useState([])
  const [tab, setTab] = useState('foryou')
  const [socialReviews, setSocialReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
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
        setHasMore(data.reviews.length === 20)
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
  const visitsById = new Map(visits.map((visit) => [visit.id, visit]))
  const recent = [...visits].sort(newestFirst).slice(0, 10)
  const favourite = restaurants
    .map((r) => ({ ...r, rating: averageRating(visits.filter((v) => v.restaurantId === r.id)) }))
    .filter((r) => r.rating != null)
    .sort((a, b) => b.rating - a.rating)[0]
  const dishCount = visits.reduce((count, visit) => count + visit.dishes.length, 0)
  const categories = categoryCounts(restaurants)
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
  // The next 20 reviews, continuing from the last one shown
  async function loadMore() {
    const last = socialReviews.at(-1)
    if (!last?.activityAt || loadingMore) return
    setLoadingMore(true)
    setError('')
    try {
      const data = await api(`/api/profiles/feed?scope=${tab}&before=${encodeURIComponent(last.activityAt)}`)
      setSocialReviews((current) => [...current, ...data.reviews.filter((review) => !current.some((r) => r.id === review.id))])
      setHasMore(data.reviews.length === 20)
    } catch (failure) {
      setError(failure.message)
    } finally {
      setLoadingMore(false)
    }
  }
  function changeTab(value) {
    if (value === tab) return
    setLoading(value !== 'journal')
    setError('')
    setTab(value)
  }
  function reviewChanged(partial) {
    setSocialReviews((current) => mergeReview(current, partial))
    updateVisit(partial)
  }
  return (
    <div className="page-enter home-scrapbook pb-20">
      {createPortal(
        <Link to="/log/new" className="home-new-review">
          <PencilIcon />
          <span>New review</span>
        </Link>,
        document.body,
      )}
      <header className="relative z-30 mb-7 flex flex-wrap items-center justify-between gap-4 border-b border-dashed border-line pb-5">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            The Log<span className="ml-2 text-brand">.</span>
          </h1>
          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted">
            Dishboxd / {formatMonth()}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3 sm:gap-4">
          <NotificationBell />
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
        className="paper-card home-welcome home-scrapbook-welcome relative grid gap-9 p-6 sm:p-8 lg:grid-cols-[1fr_22rem] lg:gap-8"
        aria-labelledby="welcome-title"
      >
        <span className="home-welcome-checks" aria-hidden="true" />
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
            <span className="home-scribble-title text-brand">Better memories.<svg viewBox="0 0 360 18" preserveAspectRatio="none" aria-hidden="true"><path d="M3 10Q165-3 352 8M39 15Q190 7 324 13" /></svg></span>
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-7 text-muted">
            Welcome back, {name.split(' ')[0]}. A favourite dish, a little discovery, a table worth returning
            to. Give every review a home in your collection.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link to="/friends" className="text-xs text-accent underline underline-offset-4">
              Find your food people ↗
            </Link>
          </div>
          <div className="home-journal-signoff" aria-hidden="true">
            <span>Made to savour</span><span>✳</span><span>Filed with love</span>
          </div>
        </div>
        <HomeMemoryCollage visits={visits} />
      </section>
      <div className="stagger my-6 grid grid-cols-3 gap-3 sm:gap-5">
        {[
          [visits.length, 'Meals remembered', 'A story in every ticket', PencilIcon, 'rose'],
          [restaurants.length, 'Places on file', 'Your own little food map', FolderIcon, 'sage'],
          [dishCount, 'Dishes tried', 'Good taste, well documented', SearchIcon, 'gold'],
        ].map(([value, label, caption, Icon, tone]) => (
          <div key={label} className={`paper-card home-stat home-stat-${tone} px-3 py-4 sm:px-5`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="home-stat-icon"><Icon /></span>
              <span className="hidden text-[9px] uppercase tracking-widest text-muted sm:block">In your journal</span>
            </div>
            <p className="font-serif text-3xl font-semibold text-brand sm:text-4xl">{String(value).padStart(2, '0')}</p>
            <p className="mt-2 text-[10px] uppercase tracking-wide text-muted sm:text-xs">{label}</p>
            <p className="mt-3 hidden border-t border-dashed border-line pt-3 font-serif text-sm italic text-muted sm:block">{caption}</p>
          </div>
        ))}
      </div>
      <HomeFoodDesk />
      <section className="home-specials mb-8" aria-labelledby="specials-title">
        <div className="home-specials-label">
          <span className="text-[9px] uppercase tracking-[0.18em] text-muted">Something to savour</span>
          <h2 id="specials-title" className="mt-1 font-serif text-xl italic text-brand">Today’s specials</h2>
        </div>
        {[
          ['/log/new', '01', 'Leave a little review', 'Turn a good meal into a keepsake.', PencilIcon],
          ['/search', '02', 'Find your next favourite', 'A familiar spot or a fresh discovery.', SearchIcon],
          ['/friends', '03', 'Pull up another chair', 'Good food is better with company.', UsersIcon],
        ].map(([to, number, title, copy, Icon]) => (
          <Link key={to} to={to} className="home-special-link">
            <span className="home-special-number">{number}</span>
            <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{title}</span><span className="mt-1 block text-[10px] leading-5 text-muted">{copy}</span></span>
            <span className="text-accent" aria-hidden="true"><Icon /></span>
          </Link>
        ))}
      </section>
      <div className="home-keepsakes">
        <FoodPassport name={name} />
        <HomeStickerCorner key={session?.user.id} userId={session?.user.id} />
      </div>
      <HomeTrays boxes={boxes} visits={visits} restaurantsById={byId} />
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <section aria-labelledby="journal-title" className="mx-auto w-full min-w-0 max-w-[40rem]">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 id="journal-title" className="font-serif text-2xl font-semibold">
              {tab === 'journal' ? 'Fresh from your journal' : tab === 'foryou' ? 'Around your table' : 'Fresh discoveries'}
            </h2>
            <div
              className="flex gap-1 rounded-md border border-line bg-card p-1"
              role="group"
              aria-label="Choose a review feed"
            >
              {[
                ['foryou', 'For you'],
                ['journal', 'Yours'],
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
                    currentUserId={session?.user.id}
                    onShare={shareVisit}
                    onChange={updateVisit}
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
                  Your journal starts with one good meal. Write a review, add a photo from the day, and
                  file it in a box if you like.
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
                    ['03', 'File it in your collection'],
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
                <ReviewCard
                  key={review.id}
                  review={visitsById.has(review.id) ? { ...review, stickers: visitsById.get(review.id).stickers ?? [] } : review}
                  currentUserId={session?.user.id}
                  onChange={reviewChanged}
                />
              ))}
              {hasMore && (
                <Button variant="secondary" className="w-full" disabled={loadingMore} onClick={loadMore}>
                  {loadingMore ? 'Gathering more stories…' : 'Load more'}
                </Button>
              )}
            </div>
          ) : (
            <div className="paper-card p-8">
              <h3 className="font-serif text-2xl font-semibold">
                {tab === 'foryou' ? 'Your table is quiet, for now.' : 'The next story could be yours.'}
              </h3>
              <p className="mt-3 text-sm leading-7 text-muted">
                {tab === 'foryou'
                  ? 'Follow diners to see their shared reviews and reposts here. Reviews you repost from Discover show up here too.'
                  : 'No shared reviews from other diners yet. Share one of yours from your profile.'}
              </p>
              <Link
                to="/friends"
                className="mt-5 inline-block text-sm text-accent underline underline-offset-4"
              >
                Meet other diners →
              </Link>
            </div>
          )}
        </section>
      <aside className="min-w-0 space-y-5">
          <section className="paper-card home-margin-note p-5">
            <div className="home-coffee-stamp" aria-hidden="true">
              <svg viewBox="0 0 60 60" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M14 25h28v11a12 12 0 0 1-12 12h-4a12 12 0 0 1-12-12V25ZM42 28h4a6 6 0 0 1 0 12h-5M10 51h38M23 19c-7-7 6-7 0-14M33 19c-7-7 6-7 0-14" />
              </svg>
            </div>
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
          {restaurants.length > 0 && (
            <section className="paper-card p-5" aria-labelledby="sorted-title">
              <p className="text-[10px] uppercase tracking-[0.18em] text-accent">Your places, sorted</p>
              <h2 id="sorted-title" className="mt-3 font-serif text-xl font-semibold">
                By category
              </h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {categories.map(({ name, count }) => (
                  <li key={name}>
                    <Link
                      to={`/search?category=${encodeURIComponent(name)}`}
                      className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-xs hover:border-accent hover:text-accent"
                    >
                      {name}
                      <span className="text-muted">{count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="people-title">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="people-title" className="font-serif text-xl font-semibold">
                Around the table
              </h2>
              <Link to="/friends" className="text-xs text-accent underline">
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
                <Link to="/friends" className="text-accent underline">
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
            <span className="mt-3 block text-xs text-accent">Open your collection →</span>
          </Link>
        </aside>
      </div>
    </div>
  )
}
