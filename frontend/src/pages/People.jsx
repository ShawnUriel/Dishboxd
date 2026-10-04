import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PersonCard from '../components/molecules/PersonCard.jsx'
import TextField from '../components/atoms/TextField.jsx'
import { api } from '../lib/api.js'
import { authClient } from '../lib/auth.js'

export default function People() {
  const { data: session } = authClient.useSession()
  const [query, setQuery] = useState('')
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true)
      setError('')
      api(`/api/profiles?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((data) => {
          setPeople(data.profiles)
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
  }, [query])
  function update(person) {
    setPeople((current) => current.map((p) => (p.id === person.id ? person : p)))
  }
  return (
    <div className="page-enter mx-auto max-w-5xl">
      <Link to="/profile" className="text-xs uppercase tracking-wider text-accent">
        ← Your profile
      </Link>
      <h1 className="mt-5 font-serif text-4xl font-bold">Find your food people.</h1>
      <p className="mt-3 max-w-xl text-sm leading-7 text-muted">
        A familiar order. A new favourite. Follow diners whose taste you trust.
      </p>
      <TextField
        id="people-search"
        label="Search diners"
        placeholder="Name or username…"
        value={query}
        maxLength={60}
        onChange={(e) => setQuery(e.target.value)}
        className="my-8 max-w-lg"
      />
      {error && (
        <p role="alert" className="mb-4 text-sm text-brand">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status" className="text-sm text-muted">
          Opening the guest book…
        </p>
      ) : people.length ? (
        <div className="stagger grid gap-4 md:grid-cols-2">
          {people.map((person) => (
            <PersonCard key={person.id} person={person} currentUserId={session?.user.id} onChange={update} />
          ))}
        </div>
      ) : (
        <div className="paper-card p-8 text-sm text-muted">
          {query
            ? 'No diners match that name. Try another search.'
            : 'The guest book is just getting started. Other diners appear after opening their profile.'}
        </div>
      )}
    </div>
  )
}
