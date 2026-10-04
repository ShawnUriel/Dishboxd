import { useEffect, useState } from 'react'
import { SearchIcon } from '../atoms/Icon.jsx'
import ManualPlaceForm from '../molecules/ManualPlaceForm.jsx'
import SearchResultItem from '../molecules/SearchResultItem.jsx'
import { api } from '../../lib/api.js'
import { useJournal } from '../../state/useJournal.js'

const SEARCH_DELAY_MS = 350
const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()

// The "search slip" and its results:
// 1. restaurants already ON FILE whose name or address matches,
// 2. Google Maps places to eat that match (an exact name match goes first; Enter picks it),
// 3. a NEW card to add the typed name by hand, for places not on Google Maps.
export default function SearchAutocomplete({ onSelect }) {
  const { restaurants } = useJournal()
  const [query, setQuery] = useState('')
  const [google, setGoogle] = useState({ query: '', places: [], error: '' })

  const search = query.trim()

  // Ask Google only after typing pauses, so a name costs one request instead of one per letter
  useEffect(() => {
    if (search.length < 2) return
    let stale = false
    const timer = setTimeout(() => {
      api(`/api/places/autocomplete?q=${encodeURIComponent(search)}`)
        .then((data) => !stale && setGoogle({ query: search, places: data.places, error: '' }))
        .catch((error) => !stale && setGoogle({ query: search, places: [], error: error.message }))
    }, SEARCH_DELAY_MS)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [search])

  const onFile = restaurants.filter((restaurant) =>
    `${restaurant.name} ${restaurant.address}`.toLowerCase().includes(search.toLowerCase()),
  )
  // If the typed name is exactly one already on file, use its ON FILE card instead of adding a duplicate
  const exactOnFile = restaurants.find((restaurant) => sameName(restaurant.name, search))

  // Google's answer only counts while it is for what is typed right now
  const googleIsCurrent = search.length >= 2 && google.query === search
  const searching = search.length >= 2 && !googleIsCurrent
  const filedPlaceIds = new Set(restaurants.map((restaurant) => restaurant.placeId).filter(Boolean))
  const googlePlaces = googleIsCurrent ? google.places.filter((place) => !filedPlaceIds.has(place.placeId)) : []
  const exactGoogle = googlePlaces.find((place) => sameName(place.name, search))
  const sortedGoogle = exactGoogle ? [exactGoogle, ...googlePlaces.filter((place) => place !== exactGoogle)] : googlePlaces

  // Enter picks the exact match: the one already on file first, otherwise Google's
  function handleKeyDown(event) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (exactOnFile) onSelect(exactOnFile, exactOnFile)
    else if (exactGoogle) onSelect(exactGoogle, null)
  }

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
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent font-serif text-lg text-ink placeholder:text-faint placeholder:italic focus:outline-none"
          />
        </div>
        {searching && <p className="mt-2 font-mono text-xs text-muted">Searching Google Maps…</p>}
        {googleIsCurrent && google.error && (
          <p className="mt-2 font-mono text-xs text-muted">{google.error} You can still add it yourself below.</p>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {onFile.length} on file{googleIsCurrent && `, ${sortedGoogle.length} from Google Maps`}
      </p>

      <ul className="mt-6 space-y-4">
        {onFile.map((restaurant) => (
          <SearchResultItem key={restaurant.id} place={restaurant} restaurant={restaurant} onSelect={onSelect} />
        ))}

        {sortedGoogle.map((place) => (
          <SearchResultItem key={place.placeId} place={place} exact={place === exactGoogle} onSelect={onSelect} />
        ))}

        {search && !exactOnFile && <ManualPlaceForm name={search} onAdd={(place) => onSelect(place, null)} />}
      </ul>

      {sortedGoogle.length > 0 && (
        <p className="mt-3 text-right font-mono text-xs text-muted">Restaurant results from Google Maps</p>
      )}

      {!search && restaurants.length === 0 && (
        <p className="mt-6 font-mono text-sm text-muted">
          Nothing on file yet. Type a restaurant name to start your first ticket.
        </p>
      )}
    </div>
  )
}
