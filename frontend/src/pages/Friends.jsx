import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Button from '../components/atoms/Button.jsx'
import { SearchIcon, UsersIcon } from '../components/atoms/Icon.jsx'
import PersonCard from '../components/molecules/PersonCard.jsx'
import ReviewCard from '../components/molecules/ReviewCard.jsx'
import { api } from '../lib/api.js'
import { authClient } from '../lib/auth.js'
import { mergeReview } from '../lib/reviews.js'

const TABS = [
  ['friends', 'Friends'],
  ['followBack', 'Follow back'],
  ['following', 'Following'],
]

// Your people: friends (you follow each other), diners to follow back, diners you follow,
// a directory search, and co-review invites waiting for an answer.
export default function Friends() {
  const { data: session } = authClient.useSession()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'find' || TABS.some(([value]) => value === params.get('tab'))
    ? params.get('tab')
    : 'friends'
  const [people, setPeople] = useState(null)
  const [invites, setInvites] = useState([])
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const query = (params.get('q') ?? '').slice(0, 60)

  useEffect(() => {
    let active = true
    Promise.all([api('/api/profiles/friends'), api('/api/reviews/invites')])
      .then(([circle, pending]) => {
        if (!active) return
        setPeople([...circle.friends, ...circle.followBack, ...circle.following])
        setInvites(pending.invites)
        setError('')
      })
      .catch((failure) => active && setError(failure.message))
    return () => {
      active = false
    }
  }, [attempt])

  // A follow or unfollow anywhere on the page moves the person to the right list
  function changed(person) {
    setPeople((current) => {
      const people = current ?? []
      return people.some((p) => p.id === person.id)
        ? people.map((p) => (p.id === person.id ? person : p))
        : [...people, person]
    })
    setNotice(person.isFriend
      ? `You and ${person.name} are now friends.`
      : person.isFollowing
        ? `Added ${person.name}. You are following them; you become friends when they follow you back.`
        : `You are no longer following ${person.name}.`)
  }

  function answered(partial) {
    const invite = invites.find((review) => review.id === partial.id)
    if (!invite) return
    if (partial.coauthor?.status === 'accepted' || partial.coauthor === null) {
      setInvites((current) => current.filter((review) => review.id !== partial.id))
      setNotice(
        partial.coauthor
          ? `You are now a co-author of ${invite.author?.name}’s review of ${invite.restaurant.name}.`
          : `Invite from ${invite.author?.name} declined.`,
      )
    } else {
      setInvites((current) => mergeReview(current, partial))
    }
  }

  const list = people ?? []
  const groups = {
    friends: list.filter((p) => p.isFriend),
    followBack: list.filter((p) => p.followsYou && !p.isFollowing),
    following: list.filter((p) => p.isFollowing && !p.followsYou),
  }
  const empty = {
    friends: 'Friends are diners you follow who follow you back. Follow someone, or follow back a diner who follows you.',
    followBack: 'Nobody waiting for a follow back. When a diner follows you, they show up here.',
    following: 'Everyone you follow already follows you back.',
  }

  return (
    <div className="page-enter mx-auto max-w-5xl">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-dashed border-line pb-7">
        <div>
          <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-brand">Your table / Friends</p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
            Your food people<span className="text-brand">.</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-muted">
            Friends follow each other. Share a meal, then write about it together in a co-review.
          </p>
        </div>
        <Link to="/profile" className="text-xs text-accent underline underline-offset-4">
          Your profile card →
        </Link>
      </header>

      <div className="my-7 grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-box-lavender/20 py-5">
        {[
          [groups.friends.length, 'Friends'],
          [groups.followBack.length, 'Follow you'],
          [invites.length, 'Co-review invites'],
        ].map(([value, label]) => (
          <div key={label} className="px-3 text-center sm:px-6 sm:text-left">
            <span className="block font-serif text-3xl font-semibold">{String(value).padStart(2, '0')}</span>
            <span className="mt-1 block text-[9px] uppercase leading-5 tracking-wider text-muted sm:text-[10px]">{label}</span>
          </div>
        ))}
      </div>

      {error && (
        <div role="alert" className="mb-6 rounded-md border border-brand/20 bg-card p-4 text-sm text-brand">
          {error}
          <Button variant="secondary" size="sm" className="ml-3" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </Button>
        </div>
      )}
      {notice && (
        <p role="status" className="mb-6 rounded-lg border border-line bg-box-mint/25 px-5 py-4 text-sm leading-6">
          {notice}
        </p>
      )}

      {invites.length > 0 && (
        <section aria-labelledby="invites-title" className="mb-10">
          <h2 id="invites-title" className="font-serif text-2xl font-semibold">
            Co-review invites
          </h2>
          <p className="mt-1 text-xs leading-6 text-muted">
            Accept to appear as a second author. Decline and the review stays theirs alone.
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {invites.map((review) => (
              <ReviewCard key={review.id} review={review} currentUserId={session?.user.id} onChange={answered} />
            ))}
          </div>
        </section>
      )}

      <form
        role="search"
        aria-label="Find and add users"
        className="paper-card mb-4 p-5 sm:p-6"
        onSubmit={(event) => {
          event.preventDefault()
          setParams({ tab: 'find', ...(query ? { q: query } : {}) }, { replace: true })
        }}
      >
        <label htmlFor="people-search" className="text-xs font-semibold uppercase tracking-wider text-ink">
          Search users
        </label>
        <div className="mt-3 flex flex-wrap gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-line bg-paper px-4 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand">
            <span className="shrink-0 text-muted" aria-hidden="true"><SearchIcon /></span>
            <input
              id="people-search"
              type="search"
              placeholder="Name or @username…"
              aria-describedby="people-search-hint"
              className="min-w-0 w-full bg-transparent py-3 text-base text-ink placeholder:text-faint focus:outline-none"
              value={query}
              maxLength={60}
              onChange={(event) => {
                const value = event.target.value
                setParams({ tab: 'find', ...(value ? { q: value } : {}) }, { replace: true })
              }}
            />
          </div>
          <Button type="submit">Search</Button>
        </div>
        <p id="people-search-hint" className="mt-3 text-xs leading-6 text-muted">
          Find diners by name or username and add them to follow.
        </p>
      </form>

      <nav aria-label="Friends sections" className="flex gap-1 overflow-x-auto rounded-lg border border-line bg-card p-1">
        {TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-current={tab === value ? 'page' : undefined}
            onClick={() => {
              setParams(value === 'friends' ? {} : { tab: value }, { replace: true })
            }}
            className={`shrink-0 rounded-md px-3 py-2 text-xs transition-colors ${tab === value ? 'bg-ink text-paper' : 'text-muted hover:bg-sidebar/50'}`}
          >
            {label}
            {people && <span className="ml-1.5 opacity-70">{groups[value].length}</span>}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {tab === 'find' ? (
          <FindDiners key={query} query={query} currentUserId={session?.user.id} onChange={changed} />
        ) : !people ? (
          !error && (
            <p role="status" className="text-sm text-muted">
              Setting the table…
            </p>
          )
        ) : groups[tab].length ? (
          <div className="stagger grid gap-4 md:grid-cols-2">
            {groups[tab].map((person) => (
              <PersonCard key={person.id} person={person} currentUserId={session?.user.id} onChange={changed} />
            ))}
          </div>
        ) : (
          <div className="paper-card flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-box-lavender/40 text-ink">
              <UsersIcon />
            </span>
            <div>
              <p className="text-sm leading-7 text-muted">{empty[tab]}</p>
              <button
                type="button"
                onClick={() => setParams({ tab: 'find' }, { replace: true })}
                className="mt-2 text-sm text-accent underline underline-offset-4"
              >
                Find diners →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FindDiners({ query, currentUserId, onChange }) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true)
      setError('')
      api(`/api/profiles?q=${encodeURIComponent(query.trim().replace(/^@/, ''))}`, { signal: controller.signal })
        .then((data) => {
          if (controller.signal.aborted) return
          setResults(data.profiles)
          setLoading(false)
        })
        .catch((failure) => {
          if (!controller.signal.aborted) {
            setError(failure.message)
            setLoading(false)
          }
        })
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, attempt])

  function update(person) {
    setResults((current) => current.map((p) => (p.id === person.id ? person : p)))
    onChange(person)
  }

  return (
    <>
      <h2 className="mb-4 font-serif text-2xl font-semibold">{query.trim() ? 'Search results' : 'Discover diners'}</h2>
      {error && (
        <div role="alert" className="mb-4 text-sm text-brand">
          {error}
          <Button variant="secondary" size="sm" className="ml-3" onClick={() => {
            setLoading(true)
            setError('')
            setAttempt((value) => value + 1)
          }}>Retry search</Button>
        </div>
      )}
      {loading ? (
        <p role="status" className="text-sm text-muted">
          Opening the guest book…
        </p>
      ) : error ? null : results.length ? (
        <div className="stagger grid gap-4 md:grid-cols-2">
          {results.map((person) => (
            <PersonCard key={person.id} person={person} currentUserId={currentUserId} onChange={update} followLabel="Add" />
          ))}
        </div>
      ) : (
        <div role="status" className="paper-card p-8 text-sm text-muted">
          {query
            ? 'No diners match that name. Try another search.'
            : 'The guest book is just getting started. Other diners appear after opening their profile.'}
        </div>
      )}
    </>
  )
}
