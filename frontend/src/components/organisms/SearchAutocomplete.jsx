import { useState } from 'react'
import { SearchIcon } from '../atoms/Icon.jsx'
import ManualPlaceForm from '../molecules/ManualPlaceForm.jsx'
import SearchResultItem from '../molecules/SearchResultItem.jsx'
import { useJournal } from '../../state/useJournal.js'

// The "search slip" and its results:
// 1. restaurants already ON FILE whose name or address matches,
// 2. (later) Google Places results for the typed name,
// 3. a NEW card to add the typed name by hand, for places not on Google Maps.
export default function SearchAutocomplete({ onSelect }) {
  const { restaurants } = useJournal()
  const [query, setQuery] = useState('')

  const search = query.trim()
  const onFile = restaurants.filter((restaurant) =>
    `${restaurant.name} ${restaurant.address}`.toLowerCase().includes(search.toLowerCase()),
  )
  // If the typed name is exactly one already on file, use its ON FILE card instead of adding a duplicate
  const alreadyOnFile = restaurants.some((restaurant) => restaurant.name.toLowerCase() === search.toLowerCase())

  return (
    <div>
      <div role="search" className="rounded-sm border border-card-edge bg-card px-5 py-4">
        <label htmlFor="search-slip" className="font-mono text-sm uppercase tracking-widest text-muted">
          Search slip
        </label>
        <div className="mt-2 flex items-center gap-3 border-b border-dotted border-muted pb-1 text-muted focus-within:border-solid focus-within:border-brand">
          <SearchIcon />
          <input
            id="search-slip"
            type="search"
            value={query}
            maxLength={100}
            autoComplete="off"
            placeholder="Type a restaurant name…"
            onChange={(event) => setQuery(event.target.value)}
            className="w-full bg-transparent font-serif text-lg text-ink placeholder:text-faint placeholder:italic focus:outline-none"
          />
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {onFile.length} on file
      </p>

      <ul className="mt-6 space-y-4">
        {onFile.map((restaurant) => (
          <SearchResultItem key={restaurant.id} place={restaurant} restaurant={restaurant} onSelect={onSelect} />
        ))}

        {/* Google Places results go here once the API is connected (see README, next steps). */}

        {search && !alreadyOnFile && <ManualPlaceForm name={search} onAdd={(place) => onSelect(place, null)} />}
      </ul>

      {!search && restaurants.length === 0 && (
        <p className="mt-6 font-mono text-sm text-muted">
          Nothing on file yet. Type a restaurant name to start your first ticket.
        </p>
      )}
    </div>
  )
}
