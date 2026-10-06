import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../atoms/Button.jsx'
import { CATEGORY_SUGGESTIONS } from '../../lib/categories.js'
import { topDishes } from '../../lib/stats.js'

const MAX_PICKS = 8
const newRow = (values = {}) => ({ key: crypto.randomUUID(), category: '', restaurantId: '', dish: '', ...values })

// Dishes logged at one place, best scored first (then most ordered)
function dishesAt(visits, restaurantId) {
  return topDishes(
    visits.filter((visit) => visit.restaurantId === restaurantId),
    50,
  ).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.count - a.count)
}

// Choose your top picks, one per category: the place ("Caution") that is your all-time favourite
// "Cafe", and the dish to order there ("Spanish latte"). Only places you shared a review of can
// be picked, so your profile never reveals a private visit.
export default function TopPicksEditor({ picks, restaurants, visits, onSave, onCancel }) {
  const id = useId()
  const [rows, setRows] = useState(() =>
    picks.length
      ? picks.map((pick) => newRow({ category: pick.category, restaurantId: pick.restaurant.id, dish: pick.dish }))
      : [newRow()],
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const update = (key, changes) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...changes } : row)))

  // Picking a place fills in its category (when empty) and its best-scored dish
  function chooseRestaurant(row, restaurantId) {
    const restaurant = restaurants.find((r) => r.id === restaurantId)
    update(row.key, {
      restaurantId,
      category: row.category.trim() ? row.category : (restaurant?.category ?? ''),
      dish: dishesAt(visits, restaurantId)[0]?.name ?? '',
    })
  }

  function move(index, step) {
    setRows((current) => {
      const next = [...current]
      const [row] = next.splice(index, 1)
      next.splice(index + step, 0, row)
      return next
    })
  }

  // One pick for every category you have reviewed: your best-rated place there and its best dish
  function suggest() {
    const best = new Map()
    for (const restaurant of restaurants) {
      const category = restaurant.category?.trim()
      if (!category) continue
      const current = best.get(category.toLowerCase())
      if (!current || (restaurant.rating ?? 0) > (current.rating ?? 0)) best.set(category.toLowerCase(), restaurant)
    }
    setRows((current) => {
      const kept = current.filter((row) => row.restaurantId || row.category.trim())
      const used = new Set(kept.map((row) => row.category.trim().toLowerCase()))
      const added = [...best.values()]
        .filter((restaurant) => !used.has(restaurant.category.trim().toLowerCase()))
        .map((restaurant) =>
          newRow({ category: restaurant.category, restaurantId: restaurant.id, dish: dishesAt(visits, restaurant.id)[0]?.name ?? '' }),
        )
      return [...kept, ...added].slice(0, MAX_PICKS)
    })
  }

  async function save(event) {
    event.preventDefault()
    const filled = rows.filter((row) => row.restaurantId || row.category.trim() || row.dish.trim())
    const categories = filled.map((row) => row.category.trim().toLowerCase())
    if (filled.some((row) => !row.restaurantId || !row.category.trim())) {
      setError('Give every top pick a category and a restaurant, or remove it.')
      return
    }
    if (new Set(categories).size !== categories.length) {
      setError('Each category can have one top pick.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave(
        filled.map((row) => ({ category: row.category.trim(), restaurantId: row.restaurantId, dish: row.dish.trim() })),
      )
    } catch (failure) {
      setError(failure.message)
      setSaving(false)
    }
  }

  if (!restaurants.length) {
    return (
      <div className="paper-card mt-5 p-6 text-sm leading-7 text-muted">
        Top picks are places you have shared a review of. Share a review, then come back to choose your favourites.
        <div className="mt-4 flex gap-3">
          <Link to="/log/new" className="text-accent underline underline-offset-4">
            Write a review →
          </Link>
          <button type="button" onClick={onCancel} className="text-muted underline underline-offset-4">
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={save} className="paper-card mt-5 p-5 sm:p-6" aria-label="Edit your top picks">
      <p className="text-xs leading-6 text-muted">
        One favourite per category: the place you would send anyone to, and what to order there.
      </p>
      <datalist id={`${id}-categories`}>
        {CATEGORY_SUGGESTIONS.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <ol className="mt-4 space-y-3">
        {rows.map((row, index) => {
          const dishes = row.restaurantId ? dishesAt(visits, row.restaurantId) : []
          return (
            <li key={row.key} className="rounded-lg border border-line bg-paper p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Top pick {index + 1}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    aria-label={`Move top pick ${index + 1} up`}
                    className="grid size-7 place-items-center rounded text-muted hover:bg-sidebar disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={index === rows.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={`Move top pick ${index + 1} down`}
                    className="grid size-7 place-items-center rounded text-muted hover:bg-sidebar disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                    aria-label={`Remove top pick ${index + 1}`}
                    className="grid size-7 place-items-center rounded text-lg text-muted hover:bg-sidebar hover:text-brand"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Best in</span>
                  <input
                    value={row.category}
                    maxLength={40}
                    list={`${id}-categories`}
                    placeholder="Cafe"
                    onChange={(event) => update(row.key, { category: event.target.value })}
                    className="mt-1 w-full border-b border-dotted border-muted bg-transparent py-1.5 font-serif text-lg focus:border-solid focus:border-brand focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Restaurant</span>
                  <select
                    value={row.restaurantId}
                    onChange={(event) => chooseRestaurant(row, event.target.value)}
                    className="mt-1 w-full rounded-md border border-line bg-card p-2 text-sm"
                  >
                    <option value="">Choose a place…</option>
                    {restaurants.map((restaurant) => (
                      <option key={restaurant.id} value={restaurant.id}>
                        {restaurant.name}
                        {restaurant.category ? ` · ${restaurant.category}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Must-order dish</span>
                  <input
                    value={row.dish}
                    maxLength={80}
                    list={dishes.length ? `${id}-dishes-${row.key}` : undefined}
                    placeholder="Spanish latte"
                    onChange={(event) => update(row.key, { dish: event.target.value })}
                    className="mt-1 w-full border-b border-dotted border-muted bg-transparent py-1.5 font-mono text-sm focus:border-solid focus:border-brand focus:outline-none"
                  />
                  {dishes.length > 0 && (
                    <datalist id={`${id}-dishes-${row.key}`}>
                      {dishes.map((dish) => (
                        <option key={dish.name} value={dish.name} />
                      ))}
                    </datalist>
                  )}
                </label>
              </div>
            </li>
          )
        })}
      </ol>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <button
          type="button"
          disabled={rows.length >= MAX_PICKS}
          onClick={() => setRows((current) => [...current, newRow()])}
          className="text-accent underline underline-offset-4 disabled:opacity-40"
        >
          + Add a category
        </button>
        {restaurants.some((restaurant) => restaurant.category?.trim()) && (
          <button type="button" onClick={suggest} className="text-accent underline underline-offset-4">
            Suggest from my reviews
          </button>
        )}
        <span className="text-muted">Up to {MAX_PICKS}. Only places you shared a review of are listed.</span>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-brand">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? 'Saving…' : 'Save top picks'}
        </Button>
        <Button variant="secondary" size="sm" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
