import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/atoms/Button.jsx'
import { FolderIcon, SearchIcon } from '../components/atoms/Icon.jsx'
import ListGrid from '../components/organisms/ListGrid.jsx'
import { useJournal } from '../state/useJournal.js'

export default function Lists() {
  const { boxes, restaurants, addBox } = useJournal()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('newest')
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState('')
  const createButton = useRef(null)
  const byId = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]))
  const filedIds = new Set(boxes.flatMap((box) => box.restaurantIds))
  const filledCount = boxes.filter((box) => box.restaurantIds.length > 0).length
  const search = query.trim().toLowerCase()
  const visible = boxes
    .map((box, index) => ({ ...box, number: index + 1 }))
    .filter((box) => {
      const matchesFilter = filter === 'all' || (filter === 'filled' ? box.restaurantIds.length > 0 : box.restaurantIds.length === 0)
      const names = box.restaurantIds.map((id) => byId.get(id)?.name || '').join(' ')
      return matchesFilter && `${box.title} ${box.description} ${names}`.toLowerCase().includes(search)
    })
    .sort((a, b) => {
      if (sort === 'name') return a.title.localeCompare(b.title)
      if (sort === 'largest') return b.restaurantIds.length - a.restaurantIds.length || a.number - b.number
      return b.number - a.number
    })

  function openCreate() {
    setNotice('')
    setAdding(true)
    document.getElementById('new-box-title')?.focus()
  }

  function closeCreate() {
    setAdding(false)
    createButton.current?.focus()
  }

  async function createBox(title) {
    await addBox(title)
    setQuery('')
    setFilter('all')
    setSort('newest')
    setNotice(`“${title}” is ready. Open a restaurant to file it in your new box.`)
    closeCreate()
  }

  return (
    <div className="page-enter mx-auto max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-dashed border-line pb-7">
        <div>
          <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-brand">Your tray / Personal collections</p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
            The Card Catalog<span className="text-brand">.</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-muted">
            A little order for your favourite places. Gather them by craving, occasion, or wherever the day takes you.
          </p>
        </div>
        <Button ref={createButton} onClick={openCreate} aria-expanded={adding} aria-controls="new-box-panel">
          <span aria-hidden="true" className="mr-2">+</span> New box
        </Button>
      </header>

      <div className="my-7 grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-sidebar/35 py-5">
        {[
          [boxes.length, 'Boxes on file'],
          [filedIds.size, 'Places collected'],
          [restaurants.filter((restaurant) => !filedIds.has(restaurant.id)).length, 'Yet to be filed'],
        ].map(([value, label]) => (
          <div key={label} className="px-3 text-center sm:px-6 sm:text-left">
            <span className="block font-serif text-3xl font-semibold text-ink">{value.toString().padStart(2, '0')}</span>
            <span className="mt-1 block text-[9px] uppercase leading-5 tracking-wider text-muted sm:text-[10px]">{label}</span>
          </div>
        ))}
      </div>

      {adding && <NewBoxForm onCreate={createBox} onCancel={closeCreate} />}
      {notice && <p role="status" className="mb-6 rounded-lg border border-line bg-box-mint/25 px-5 py-4 text-sm leading-6">{notice}</p>}

      {boxes.length > 0 ? (
        <section aria-labelledby="your-boxes-heading">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <h2 id="your-boxes-heading" className="font-serif text-2xl font-semibold">On the shelf</h2>
            <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-card p-1" role="group" aria-label="Filter boxes">
              {[
                ['all', 'All boxes', boxes.length],
                ['filled', 'Filled', filledCount],
                ['empty', 'Empty', boxes.length - filledCount],
              ].map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={`rounded-md px-3 py-2 text-xs transition-colors ${filter === value ? 'bg-ink text-paper' : 'text-muted hover:bg-sidebar/50'}`}
                >
                  {label} <span className="ml-1 opacity-70">{count}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="mb-7 flex flex-col gap-3 sm:flex-row">
            <label className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-line bg-card px-4 py-3 focus-within:border-accent">
              <span className="text-muted"><SearchIcon /></span>
              <span className="sr-only">Search boxes or restaurants</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a box or restaurant…"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
              />
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-line bg-card px-4 py-3 text-xs text-muted">
              Sort by
              <select value={sort} onChange={(event) => setSort(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-ink sm:flex-none">
                <option value="newest">Newest first</option>
                <option value="name">Name A–Z</option>
                <option value="largest">Most restaurants</option>
              </select>
            </label>
          </div>
          {visible.length > 0 ? (
            <ListGrid boxes={visible} restaurantsById={byId} onCreate={openCreate} />
          ) : (
            <div className="paper-card px-6 py-12 text-center">
              <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-sidebar text-muted"><SearchIcon /></span>
              <h3 className="font-serif text-2xl font-semibold">Nothing in this section yet.</h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted">Try a different name or show all boxes to find what you’re looking for.</p>
              <Button variant="secondary" size="sm" className="mt-5" onClick={() => { setQuery(''); setFilter('all') }}>Show all boxes</Button>
            </div>
          )}
          <p role="status" className="mt-6 text-xs text-muted">
            {visible.length} of {boxes.length} {boxes.length === 1 ? 'box' : 'boxes'} on the shelf
          </p>
        </section>
      ) : (
        <section className="paper-card grid items-center gap-8 px-6 py-10 sm:px-10 md:grid-cols-[1fr_1.3fr]" aria-labelledby="empty-tray-heading">
          <div className="catalog-empty-art" aria-hidden="true">
            <div className="catalog-empty-card catalog-empty-card-back" />
            <div className="catalog-empty-card catalog-empty-card-front"><span>GOOD PLACES</span><span>worth keeping.</span></div>
            <div className="catalog-empty-folder"><FolderIcon /><span>YOUR FIRST BOX</span></div>
          </div>
          <div>
            <p className="mb-3 text-[10px] uppercase tracking-[0.18em] text-brand">A collection starts with one place</p>
            <h2 id="empty-tray-heading" className="font-serif text-3xl font-semibold leading-tight sm:text-4xl">Make room for your favourites.</h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-muted">Sunday coffee, comfort food, dinner with friends. Give your box a name, then file restaurants from your journal into it.</p>
            <Button className="mt-6" onClick={openCreate}>Create your first box</Button>
          </div>
        </section>
      )}

      <aside className="mt-8 flex flex-col gap-4 rounded-xl border border-dashed border-line bg-paper/80 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-1 text-accent"><FolderIcon /></span>
          <p className="max-w-xl text-xs leading-6 text-muted">
            <strong className="font-medium text-ink">A place for every kind of good meal.</strong><br />
            Open a restaurant in your journal and choose “File in a box” to add it to a collection.
          </p>
        </div>
        <Link to="/search" className="shrink-0 text-xs font-medium text-accent underline underline-offset-4">Find a restaurant <span aria-hidden="true">↗</span></Link>
      </aside>
    </div>
  )
}

function NewBoxForm({ onCreate, onCancel }) {
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const input = useRef(null)

  async function submit(event) {
    event.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      await onCreate(title.trim())
    } catch (failure) {
      setError(failure.message)
      setSaving(false)
    }
  }

  return (
    <form id="new-box-panel" onSubmit={submit} className="paper-card mb-7 border-t-4 border-t-brand p-5 sm:p-7" aria-labelledby="new-box-heading">
      <div className="mb-5 flex items-start gap-3">
        <span className="mt-1 text-brand"><FolderIcon /></span>
        <div>
          <h2 id="new-box-heading" className="font-serif text-2xl font-semibold">Give your collection a name.</h2>
          <p className="mt-2 text-xs leading-6 text-muted">Something delicious to come back to. You can file restaurants after creating it.</p>
        </div>
      </div>
      <label htmlFor="new-box-title" className="mb-2 block text-xs font-medium">Box name</label>
      <input ref={input} id="new-box-title" autoFocus required maxLength={60} value={title} disabled={saving} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Sunday coffee spots" className="w-full rounded-md border border-line bg-paper px-4 py-3 text-sm focus:border-brand" />
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted">
        <span>Try a name:</span>
        {['Coffee spots', 'Comfort food', 'Worth a detour'].map((name) => (
          <button key={name} type="button" disabled={saving} onClick={() => { setTitle(name); input.current?.focus() }} className="rounded-full border border-line px-3 py-1.5 hover:border-accent hover:text-accent disabled:opacity-50">{name}</button>
        ))}
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-brand">{error}</p>}
      <div className="mt-5 flex flex-wrap gap-3">
        <Button type="submit" size="sm" disabled={!title.trim() || saving}>{saving ? 'Creating…' : 'Create box'}</Button>
        <Button variant="secondary" size="sm" disabled={saving} onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}
