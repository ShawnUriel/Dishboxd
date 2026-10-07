import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/atoms/Button.jsx'
import TextField from '../components/atoms/TextField.jsx'
import BookmarkButton from '../components/molecules/BookmarkButton.jsx'
import { useJournal } from '../state/useJournal.js'

export default function Bookmarks() {
  const { bookmarks, saveBookmark } = useJournal()
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const filtered = bookmarks.filter((item) => `${item.name} ${item.address} ${item.category}`.toLowerCase().includes(query.toLowerCase()))
  async function add(event) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try { await saveBookmark({ name, address }); setName(''); setAddress(''); setQuery(''); setNotice('Saved to your want-to-try list.') }
    catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  return <div className="page-enter mx-auto max-w-4xl">
    <Link to="/lists" className="text-xs text-accent underline">← Collections</Link>
    <header className="my-6 border-b border-dashed border-line pb-6">
      <p className="text-[10px] uppercase tracking-widest text-brand">Good things to come / Private list</p>
      <h1 className="mt-2 font-serif text-4xl font-semibold">Want to try</h1>
      <p className="mt-3 text-sm leading-7 text-muted">Keep a little list of your next good meals. Only you can see these bookmarks.</p>
    </header>
    <form onSubmit={add} className="paper-card mb-6 space-y-4 p-5" aria-label="Bookmark a restaurant">
      <h2 className="font-serif text-xl">Heard about a good spot?</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="bookmark-name" label="Restaurant name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required />
        <TextField id="bookmark-address" label="Address (optional)" value={address} onChange={(event) => setAddress(event.target.value)} maxLength={120} />
      </div>
      <div className="flex flex-wrap items-center gap-4"><Button type="submit" size="sm" disabled={busy}>{busy ? 'Saving…' : 'Save for later'}</Button><Link to="/search" className="text-xs text-accent underline">Search for a restaurant</Link></div>
      {error && <p role="alert" className="text-xs text-brand">{error}</p>}
      {notice && <p role="status" className="text-xs text-accent">{notice}</p>}
    </form>
    <TextField id="bookmark-filter" label={`Your saved places (${bookmarks.length})`} placeholder="Filter by name or neighbourhood" value={query} onChange={(event) => setQuery(event.target.value)} />
    <ul className="mt-5 grid gap-4 sm:grid-cols-2">{filtered.map((place) => <li key={place.id} className="paper-card flex flex-col items-start gap-3 p-5">
      <h2 className="break-words font-serif text-2xl">{place.name}</h2>
      <p className="text-xs leading-6 text-muted">{place.address || 'A place for your next food story.'}</p>
      <BookmarkButton place={place} />
      <Link to="/log/new" state={{ place }} className="mt-auto pt-2 text-xs text-accent underline">Been here? Write a review →</Link>
    </li>)}</ul>
    {!filtered.length && <p className="paper-card mt-5 p-8 text-sm text-muted">{bookmarks.length ? 'No saved places match your search.' : 'Your next favourite is waiting. Save a place from Search, a review, or the form above.'}</p>}
  </div>
}
