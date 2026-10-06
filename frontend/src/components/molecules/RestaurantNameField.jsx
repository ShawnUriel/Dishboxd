import { useEffect, useId, useState } from 'react'
import CategoryTag from '../atoms/CategoryTag.jsx'
import { api } from '../../lib/api.js'
import { restaurantCode } from '../../lib/format.js'
import { useGooglePlacePhoto } from '../../lib/useGooglePlacePhoto.js'

const SEARCH_DELAY_MS = 350

// The ticket's restaurant name, searching as you type: places already in your journal first,
// then Google Maps places to eat with a photo. Picking one fills in the ticket; a name that
// matches nothing is simply kept as typed, for places that are not on Google Maps.
// Keyboard: arrows move through the list, Enter picks, Escape closes it.
export default function RestaurantNameField({ value, onChange, restaurants, onPickGoogle, onPickSaved }) {
  const id = useId()
  const listId = `${id}-places`
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [google, setGoogle] = useState({ query: '', places: [], error: '' })
  const search = value.trim()

  // Ask Google only after typing pauses, and only while the list is open
  useEffect(() => {
    if (!open || search.length < 2) return
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
  }, [open, search])

  const lower = search.toLowerCase()
  const saved = search
    ? restaurants.filter((r) => `${r.name} ${r.address}`.toLowerCase().includes(lower)).slice(0, 3)
    : []
  const current = search.length >= 2 && google.query === search
  const filed = new Set(restaurants.map((r) => r.placeId).filter(Boolean))
  const fromGoogle = current ? google.places.filter((place) => !filed.has(place.placeId)) : []
  const options = [
    ...saved.map((restaurant) => ({ kind: 'saved', key: restaurant.id, restaurant })),
    ...fromGoogle.map((place) => ({ kind: 'google', key: place.placeId, place })),
  ]
  const showList = open && search.length >= 2

  function pick(option) {
    if (option.kind === 'saved') onPickSaved(option.restaurant)
    else onPickGoogle(option.place)
    setOpen(false)
    setActive(-1)
  }

  function handleKey(event) {
    if (!showList) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((index) => (options.length ? (index + step + options.length) % options.length : -1))
    } else if (event.key === 'Enter' && options[active]) {
      event.preventDefault()
      pick(options[active])
    } else if (event.key === 'Escape') {
      setOpen(false)
      setActive(-1)
    }
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="font-mono text-xs uppercase tracking-widest text-muted">
        Restaurant name
      </label>
      <input
        id={id}
        type="text"
        value={value}
        maxLength={100}
        required
        autoComplete="off"
        placeholder="Search Google Maps or type any name…"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && options[active] ? `${listId}-${active}` : undefined}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => search.length >= 2 && setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKey}
        className="mt-1 w-full border-b border-dotted border-muted bg-transparent py-1.5 font-mono text-base text-ink placeholder:text-faint focus:border-solid focus:border-brand focus:outline-none"
      />
      {showList && (
        // Choosing with the mouse must not blur the input first, or the list closes before the click
        <div
          className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-lg border border-card-edge bg-card shadow-lg"
          onMouseDown={(event) => event.preventDefault()}
        >
          <ul id={listId} role="listbox" aria-label="Restaurants" className="max-h-80 overflow-y-auto">
            {options.map((option, index) => (
              <li
                key={option.key}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                onClick={() => pick(option)}
                onMouseEnter={() => setActive(index)}
                className={`flex cursor-pointer items-center gap-3 border-b border-dashed border-line px-3 py-2.5 last:border-b-0 ${
                  index === active ? 'bg-sidebar/60' : ''
                }`}
              >
                {option.kind === 'saved' ? (
                  <>
                    <span className="grid size-11 shrink-0 place-items-center rounded-md border border-card-edge bg-badge font-mono text-[10px] text-muted">
                      {restaurantCode(option.restaurant.number, true)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-serif text-base font-semibold">{option.restaurant.name}</span>
                      <span className="block truncate text-[11px] text-muted">
                        In your journal{option.restaurant.address ? ` · ${option.restaurant.address}` : ''}
                      </span>
                    </span>
                    <CategoryTag category={option.restaurant.category} className="hidden sm:inline-block" />
                  </>
                ) : (
                  <GoogleOption place={option.place} />
                )}
              </li>
            ))}
          </ul>
          <p className="border-t border-line bg-paper px-3 py-2 font-mono text-[11px] leading-5 text-muted" role="status">
            {!current
              ? 'Searching Google Maps…'
              : google.error
                ? `${google.error} Keep typing to add it yourself.`
                : fromGoogle.length
                  ? 'Places from Google Maps. Not here? Keep typing to add it yourself.'
                  : 'No match on Google Maps. Keep typing to add it yourself.'}
          </p>
        </div>
      )}
    </div>
  )
}

// A Google Maps place with its photo (looked up through our server) and the photo's credit
function GoogleOption({ place }) {
  const { photo } = useGooglePlacePhoto(place.placeId)
  const [broken, setBroken] = useState(false)
  const shown = photo && !broken
  return (
    <>
      {shown ? (
        <img
          src={photo.url}
          alt=""
          onError={() => setBroken(true)}
          className="size-11 shrink-0 rounded-md object-cover"
        />
      ) : (
        <span aria-hidden="true" className="size-11 shrink-0 rounded-md border border-line bg-sidebar/50" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-serif text-base font-semibold">{place.name}</span>
        <span className="block truncate text-[11px] text-muted">{place.address}</span>
        {shown && photo.attributions?.[0] && (
          <span className="block truncate text-[10px] text-faint">Photo: {photo.attributions[0].name}</span>
        )}
      </span>
      <CategoryTag category={place.category} className="hidden sm:inline-block" />
    </>
  )
}
