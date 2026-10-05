import { useState } from 'react'
import Button from '../atoms/Button.jsx'
import CategoryTag from '../atoms/CategoryTag.jsx'
import PhotoThumbnail from '../atoms/PhotoThumbnail.jsx'
import RatingCircle from '../atoms/RatingCircle.jsx'
import Photo from '../atoms/Photo.jsx'
import CategoryField from '../molecules/CategoryField.jsx'
import { restaurantCode } from '../../lib/format.js'

// Polaroid photo, catalog number, name, category, address and average rating.
// With onSaveCategory, the category can be added or changed here.
export default function RestaurantHeader({ restaurant, rating, photoId, onSaveCategory }) {
  const [category, setCategory] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSaveCategory(category.trim())
      setCategory(null)
    } catch (failure) {
      setError(failure.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <header className="flex flex-col items-center text-center">
      <div className="-rotate-2 bg-white p-1.5 shadow-md">
        {photoId ? (
          <Photo id={photoId} alt={restaurant.name} className="size-40 md:size-44" />
        ) : (
          <PhotoThumbnail className="size-40 md:size-44" />
        )}
      </div>
      <p className="mt-5 font-mono text-sm tracking-widest text-muted">{restaurantCode(restaurant.number)}</p>
      <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight">{restaurant.name}</h1>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        {restaurant.category ? (
          <CategoryTag category={restaurant.category} />
        ) : (
          <span className="font-mono text-xs text-muted">Not sorted into a category yet</span>
        )}
        {onSaveCategory && category === null && (
          <button
            type="button"
            onClick={() => setCategory(restaurant.category ?? '')}
            className="font-mono text-xs text-accent underline underline-offset-4"
          >
            {restaurant.category ? 'Change' : 'Add a category'}
          </button>
        )}
      </div>
      {category !== null && (
        <form onSubmit={save} className="mt-4 w-full rounded-md border border-line bg-card p-4 text-left">
          <CategoryField value={category} onChange={setCategory} />
          {error && (
            <p role="alert" className="mt-3 text-sm text-brand">
              {error}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? 'Saving…' : 'Save category'}
            </Button>
            <Button variant="secondary" size="sm" disabled={saving} onClick={() => setCategory(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      {restaurant.address && <p className="mt-2 font-mono text-sm text-muted">{restaurant.address}</p>}
      {/* Google gives no menus through its API, so a place found on Google links to its Maps page,
          which shows the menu, photos and opening hours when the restaurant has them */}
      {restaurant.placeId && (
        <a
          href={`https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(restaurant.placeId)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 font-mono text-sm text-accent underline underline-offset-4 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Menu &amp; info on Google Maps <span aria-hidden="true">↗</span>
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
      <div className="mt-4">
        <RatingCircle value={rating} size="lg" />
      </div>
    </header>
  )
}
