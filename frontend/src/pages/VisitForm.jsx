import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Button from '../components/atoms/Button.jsx'
import TextField from '../components/atoms/TextField.jsx'
import Photo from '../components/atoms/Photo.jsx'
import StarRating from '../components/atoms/StarRating.jsx'
import TableSetting from '../components/atoms/TableSetting.jsx'
import { FolderIcon } from '../components/atoms/Icon.jsx'
import CategoryField from '../components/molecules/CategoryField.jsx'
import CoauthorPicker from '../components/molecules/CoauthorPicker.jsx'
import TicketPlacePhoto from '../components/molecules/TicketPlacePhoto.jsx'
import DishEntryList from '../components/organisms/DishEntryList.jsx'
import { api } from '../lib/api.js'
import { preparePhoto } from '../lib/photos.js'
import { newDish } from '../lib/dishes.js'
import { todayIso } from '../lib/format.js'
import { reviewOnFire } from '../lib/scores.js'
import { dishSuggestions } from '../lib/stats.js'
import { useJournal } from '../state/useJournal.js'

export default function VisitForm() {
  const location = useLocation()
  const initialPlace = location.state?.place
  const navigate = useNavigate()
  const { addVisit, addBox, visits, restaurants, boxes } = useJournal()
  const [boxId, setBoxId] = useState(() => {
    const requested = location.state?.boxId || new URLSearchParams(location.search).get('boxId')
    return boxes.some((box) => box.id === requested) ? requested : ''
  })
  const [addingBox, setAddingBox] = useState(false)
  const [boxTitle, setBoxTitle] = useState('')
  const [creatingBox, setCreatingBox] = useState(false)
  const [boxError, setBoxError] = useState('')
  const boxChoice = useRef(null)
  const [name, setName] = useState(initialPlace?.name ?? '')
  const [address, setAddress] = useState(initialPlace?.address ?? '')
  const [restaurantId, setRestaurantId] = useState(initialPlace?.restaurantId ?? '')
  const [category, setCategory] = useState(
    () => restaurants.find((r) => r.id === initialPlace?.restaurantId)?.category || initialPlace?.category || '',
  )
  const [date, setDate] = useState(todayIso)
  const [rating, setRating] = useState(0)
  const [dishes, setDishes] = useState(() => [newDish(), newDish()])
  const [notes, setNotes] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [coauthor, setCoauthor] = useState(null)
  const [choosingCoauthor, setChoosingCoauthor] = useState(false)
  const [photoIds, setPhotoIds] = useState([])
  const [uploading, setUploading] = useState(false)
  const [triedSubmit, setTriedSubmit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [photoError, setPhotoError] = useState('')
  const selectedBox = boxes.find((box) => box.id === boxId)
  const boxEditorOpen = addingBox || !boxes.length
  const inBox = restaurants.filter((restaurant) => selectedBox?.restaurantIds.includes(restaurant.id))
  const otherRestaurants = restaurants.filter((restaurant) => !selectedBox?.restaurantIds.includes(restaurant.id))
  const existing = restaurants.find((r) => r.id === restaurantId)
  const place = existing
    ? { restaurantId: existing.id, name: existing.name, address: existing.address, placeId: existing.placeId }
    : {
        name: name.trim(),
        address: address.trim(),
        placeId: name === initialPlace?.name ? (initialPlace?.placeId ?? null) : null,
      }
  const suggestions = restaurantId
    ? dishSuggestions(visits.filter((v) => v.restaurantId === restaurantId))
    : []
  const filledDishes = dishes
    .filter((d) => d.name.trim())
    .map((d) => ({
      name: d.name.trim(),
      price: Math.min(Math.max(Number(d.price) || 0, 0), 10000),
      score: d.score,
      description: d.description.trim(),
      sticker: d.sticker
        ? { stickerId: d.sticker.stickerId, x: d.sticker.x, y: d.sticker.y, rotation: d.sticker.rotation, scale: d.sticker.scale }
        : null,
    }))
  const onFire = reviewOnFire({ dishes: filledDishes })
  let problem = ''
  if (boxEditorOpen) problem = 'Create a box in your tray to keep this review.'
  else if (!selectedBox) problem = 'Choose a box from your tray for this review.'
  else if (!place.name) problem = 'Add a restaurant name or choose a saved place.'
  else if (!rating) problem = 'Pick an overall rating (1 to 5 stars).'
  else if (!filledDishes.length) problem = 'Add at least one item.'
  else if (!date || date > todayIso()) problem = 'Choose the day of your visit, up to today.'

  function chooseRestaurant(id) {
    setRestaurantId(id)
    const chosen = restaurants.find((r) => r.id === id)
    if (chosen) setCategory(chosen.category ?? '')
  }

  async function createBox() {
    if (creatingBox || saving) return
    if (!boxTitle.trim()) {
      setBoxError('Give your box a name first.')
      return
    }
    setCreatingBox(true)
    setBoxError('')
    try {
      const id = await addBox(boxTitle.trim())
      setBoxId(id)
      setAddingBox(false)
      setBoxTitle('')
      requestAnimationFrame(() => boxChoice.current?.focus())
    } catch (failure) {
      setBoxError(failure.message)
    } finally {
      setCreatingBox(false)
    }
  }

  async function uploadPhotos(event) {
    const files = [...event.target.files]
    event.target.value = ''
    if (files.length + photoIds.length > 3) {
      setPhotoError('You can add up to three photos per visit.')
      return
    }
    setUploading(true)
    setPhotoError('')
    try {
      for (const file of files) {
        const photo = await preparePhoto(file)
        const { id } = await api('/api/media', { method: 'POST', body: photo })
        setPhotoIds((current) => [...current, id])
      }
    } catch (failure) {
      setPhotoError(failure.message)
    } finally {
      setUploading(false)
    }
  }

  async function removePhoto(id) {
    setUploading(true)
    setPhotoError('')
    try {
      await api(`/api/media/${id}`, { method: 'DELETE' })
      setPhotoIds((current) => current.filter((photoId) => photoId !== id))
    } catch (failure) {
      setPhotoError(failure.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setTriedSubmit(true)
    setSaveError('')
    if (problem || saving || uploading || creatingBox) return
    setSaving(true)
    try {
      const savedId = await addVisit(place, {
        date,
        rating,
        notes: notes.trim(),
        dishes: filledDishes,
        photoIds,
        isPublic,
        category: category.trim(),
        coauthorId: coauthor?.id ?? null,
        boxId: selectedBox.id,
      })
      navigate(`/restaurant/${savedId}`)
    } catch (failure) {
      setSaveError(failure.message)
      setSaving(false)
    }
  }

  return (
    <div className="page-enter mx-auto max-w-6xl">
      <Link to="/" className="mb-6 inline-block text-xs uppercase tracking-wider text-accent">
        ← Back to the log
      </Link>
      <TableSetting>
        <form
          onSubmit={handleSubmit}
          noValidate
          aria-labelledby="ticket-title"
          className={`paper-card ticket-shadow overflow-hidden ${onFire ? 'ticket-on-fire' : ''}`}
        >
          <header className="border-b border-dashed border-line px-6 py-7 text-center sm:px-8">
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-muted">One day. One meal. Your story.</p>
            <h1 id="ticket-title" className="font-serif text-3xl font-bold">
              Dishboxd Ticket
            </h1>
            {onFire && <p className="fire-stamp mx-auto mt-3 w-fit">Something here is on fire</p>}
          </header>
          {place.placeId && <TicketPlacePhoto key={place.placeId} placeId={place.placeId} name={place.name} />}
          <div className="space-y-6 px-5 py-6 sm:px-8">
            <section aria-labelledby="tray-label" className="rounded-lg border border-line bg-sidebar/30 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className="mt-0.5 text-accent"><FolderIcon /></span>
                <div className="min-w-0 flex-1">
                  <label id="tray-label" htmlFor="review-box" className="text-xs uppercase tracking-wider text-muted">
                    From your tray
                  </label>
                  <p id="tray-hint" className="mt-1 text-xs leading-6 text-muted">
                    Pick a box for this restaurant and its reviews. Keep your good meals together.
                  </p>
                </div>
              </div>
              <select
                ref={boxChoice}
                id="review-box"
                value={boxId}
                onChange={(event) => { setBoxId(event.target.value); setAddingBox(false); setBoxError('') }}
                disabled={!boxes.length || creatingBox || saving}
                required
                aria-describedby="tray-hint"
                aria-invalid={triedSubmit && !selectedBox}
                className="mt-3 w-full rounded-md border border-line bg-paper p-3 text-sm disabled:opacity-60"
              >
                <option value="">{boxes.length ? 'Choose a box from your tray' : 'Your first box starts here'}</option>
                {boxes.map((box) => <option key={box.id} value={box.id}>{box.title}</option>)}
              </select>
              {boxEditorOpen ? (
                <div className="mt-4 space-y-3 border-t border-dashed border-line pt-4">
                  <TextField
                    id="review-box-title"
                    label={boxes.length ? 'New box name' : 'Name your first box'}
                    value={boxTitle}
                    onChange={(event) => { setBoxTitle(event.target.value); setBoxError('') }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        createBox()
                      }
                    }}
                    maxLength={60}
                    disabled={creatingBox || saving}
                    placeholder="Sunday coffee, comfort food…"
                    hint="Create it here and carry on with your review."
                  />
                  {boxError && <p role="alert" className="text-xs text-brand">{boxError}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={createBox} disabled={creatingBox || saving}>
                      {creatingBox ? 'Creating…' : 'Create & choose box'}
                    </Button>
                    {!!boxes.length && (
                      <Button variant="secondary" size="sm" disabled={creatingBox || saving} onClick={() => { setAddingBox(false); setBoxError('') }}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p role="status" className="text-xs leading-6 text-muted">
                    {selectedBox ? `This ticket will be filed in “${selectedBox.title}”.` : 'A little home for this meal.'}
                  </p>
                  <button type="button" disabled={saving} onClick={() => setAddingBox(true)} className="text-xs text-accent underline underline-offset-4 disabled:opacity-50">
                    + Create a new box
                  </button>
                </div>
              )}
            </section>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="restaurant-choice" className="text-xs uppercase tracking-wider text-muted">
                  Restaurant
                </label>
                <select
                  id="restaurant-choice"
                  value={restaurantId}
                  onChange={(e) => chooseRestaurant(e.target.value)}
                  className="mt-2 w-full rounded-md border border-line bg-paper p-3 text-sm"
                >
                  <option value="">A new restaurant</option>
                  {inBox.length > 0 && (
                    <optgroup label={`In ${selectedBox.title}`}>
                      {inBox.map((r) => <option key={r.id} value={r.id}>{r.name}{r.category ? ` · ${r.category}` : ''}</option>)}
                    </optgroup>
                  )}
                  {otherRestaurants.length > 0 && (
                    <optgroup label={selectedBox ? 'Other saved places' : 'Your saved places'}>
                      {otherRestaurants.map((r) => <option key={r.id} value={r.id}>{r.name}{r.category ? ` · ${r.category}` : ''}</option>)}
                    </optgroup>
                  )}
                </select>
              </div>
              {!existing && (
                <>
                  <TextField
                    id="restaurant-name"
                    label="Restaurant name"
                    value={name}
                    maxLength={100}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Where did you eat?"
                    required
                  />
                  <TextField
                    id="restaurant-address"
                    label="Address (optional)"
                    value={address}
                    maxLength={120}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street or neighbourhood"
                  />
                </>
              )}
              <div className="sm:col-span-2">
                <CategoryField
                  value={category}
                  onChange={setCategory}
                  hint={existing ? 'Changing it here also updates this saved place.' : undefined}
                />
              </div>
              <TextField
                id="visit-date"
                label="Day of your visit"
                type="date"
                value={date}
                max={todayIso()}
                onChange={(e) => setDate(e.target.value)}
                required
              />
              <p className="self-end pb-2 text-xs text-muted">
                <Link to="/search" className="text-accent underline underline-offset-4">
                  Find a restaurant on Google Maps ↗
                </Link>
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-y border-dashed border-line py-4">
              <span className="text-xs uppercase tracking-wider text-muted">Overall rating</span>
              <StarRating value={rating} onChange={setRating} label="Overall rating" />
            </div>
            <DishEntryList dishes={dishes} onChange={setDishes} suggestions={suggestions} />
            <div>
              <label htmlFor="notes" className="text-xs uppercase tracking-wider text-muted">
                Your review
              </label>
              <textarea
                id="notes"
                rows={5}
                maxLength={2000}
                value={notes}
                placeholder="The dish you loved, the atmosphere, the little things…"
                onChange={(e) => setNotes(e.target.value)}
                className="bg-notes mt-2 block w-full resize-y rounded-md p-2 text-sm placeholder:text-faint"
              />
            </div>
            <section aria-labelledby="visit-photos">
              <h2 id="visit-photos" className="text-xs uppercase tracking-wider text-muted">
                Photos from this visit
              </h2>
              <p className="mt-1 text-xs leading-6 text-muted">
                Your plate, your table, your experience. Add up to three photos.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {photoIds.map((id) => (
                  <div key={id} className="relative">
                    <Photo
                      id={id}
                      alt="Photo attached to this visit"
                      className="aspect-square w-full rounded-md"
                    />
                    <button
                      type="button"
                      disabled={uploading || saving}
                      onClick={() => removePhoto(id)}
                      aria-label="Remove photo"
                      className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-ink text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <label
                className={`mt-3 block rounded-md border border-dashed border-accent/50 bg-accent/5 p-5 text-center text-sm text-accent ${uploading || saving ? 'opacity-50' : 'cursor-pointer hover:bg-accent/10'}`}
              >
                {uploading ? 'Preparing your photos…' : '+ Add your photos'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={uploading || saving || photoIds.length >= 3}
                  onChange={uploadPhotos}
                  className="mt-2 block w-full text-xs file:mr-3 file:rounded file:border-0 file:bg-accent file:p-2 file:text-white"
                />
              </label>
              {photoError && (
                <p role="alert" className="mt-2 text-sm text-brand">
                  {photoError}
                </p>
              )}
            </section>
            <section aria-labelledby="coauthor-label" className="rounded-md border border-line bg-paper p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="coauthor-label" className="text-sm">
                  Ate with a friend?
                  <span className="mt-1 block text-xs leading-6 text-muted">
                    {coauthor
                      ? `${coauthor.name} gets an invite. Once they accept, this is a co-review with both of you as authors.`
                      : 'Invite one friend to co-author this review with you.'}
                  </span>
                </h2>
                {!choosingCoauthor && (
                  <button
                    type="button"
                    onClick={() => setChoosingCoauthor(true)}
                    className="text-xs text-accent underline underline-offset-4"
                  >
                    {coauthor ? 'Change' : '+ Invite a co-author'}
                  </button>
                )}
              </div>
              {choosingCoauthor && (
                <div className="mt-3 space-y-3">
                  <CoauthorPicker
                    selectedId={coauthor?.id}
                    onSelect={(friend) => {
                      setCoauthor(friend)
                      setChoosingCoauthor(false)
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setChoosingCoauthor(false)}
                    className="text-xs text-muted underline underline-offset-4"
                  >
                    Close
                  </button>
                </div>
              )}
            </section>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line bg-paper p-4">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="mt-1 size-4 accent-brand"
              />
              <span className="text-sm">
                Share this review on my profile
                <span className="mt-1 block text-xs leading-6 text-muted">
                  Other signed-in diners can see this review and its photos, like it and repost it. Leave unchecked
                  to keep it private. Your tray stays personal either way.
                </span>
              </span>
            </label>
          </div>
          {((triedSubmit && problem) || saveError) && (
            <p role="alert" className="px-6 pb-4 text-sm text-brand">
              {(triedSubmit && problem) || saveError}
            </p>
          )}
          <footer className="flex gap-3 border-t border-dashed border-line px-6 py-6 sm:px-8">
            <Button variant="secondary" onClick={() => navigate('/')} disabled={saving || creatingBox}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={saving || uploading || creatingBox}>
              {saving ? 'Stamping…' : 'Stamp & submit'}
            </Button>
          </footer>
        </form>
      </TableSetting>
    </div>
  )
}
