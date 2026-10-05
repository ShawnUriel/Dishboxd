import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { forgetSticker, uploadSticker } from '../lib/stickers.js'
import { JournalContext } from './journalContext.js'

function JournalMessage({ children }) {
  return (
    <div className="bg-lined grid min-h-screen place-items-center px-4">
      <div className="text-center font-mono text-sm text-muted">{children}</div>
    </div>
  )
}

// A sticker deleted from the book is peeled off every card that showed it
function withoutSticker(placements, stickerId) {
  return (placements ?? []).filter((placement) => placement.stickerId !== stickerId)
}

// Loads the logged-in user's restaurants, visits, boxes and sticker book from the API, and saves
// every change through it. The data lives in the Neon database, so it survives a refresh.
export function JournalProvider({ children }) {
  const [journal, setJournal] = useState({ restaurants: [], visits: [], boxes: [], stickers: [] })
  const [status, setStatus] = useState('loading')
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([api('/api/restaurants'), api('/api/visits'), api('/api/boxes'), api('/api/stickers')])
      .then(([restaurantData, visitData, boxData, stickerData]) => {
        if (cancelled) return
        setJournal({
          restaurants: restaurantData.restaurants,
          visits: visitData.visits,
          boxes: boxData.boxes,
          stickers: stickerData.stickers,
        })
        setStatus('ready')
      })
      .catch((error) => {
        if (cancelled) return
        setLoadError(error.message)
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  // Saves one ticket. A known restaurant is sent by id; a NEW one (from search,
  // or added by hand) is sent as a place for the server to file.
  // Returns the restaurant id so the caller can open its profile.
  async function addVisit(place, { date, rating, notes, dishes, photoIds = [], isPublic = false, category = '', coauthorId = null }) {
    const where = place.restaurantId
      ? { restaurantId: place.restaurantId }
      : { place: { placeId: place.placeId ?? null, name: place.name, address: place.address ?? '' } }
    const saved = await api('/api/visits', {
      method: 'POST',
      body: { ...where, date, rating, notes, dishes, photoIds, isPublic, category, coauthorId },
    })

    setJournal((current) => ({
      ...current,
      restaurants: current.restaurants.some((r) => r.id === saved.restaurant.id)
        ? current.restaurants.map((r) => (r.id === saved.restaurant.id ? saved.restaurant : r))
        : [...current.restaurants, saved.restaurant],
      visits: [saved.visit, ...current.visits],
    }))
    return saved.restaurant.id
  }

  // Keeps a review current after a like, a co-author change or new stickers
  function updateVisit(visit) {
    setJournal((current) => ({
      ...current,
      visits: current.visits.map((existing) => (existing.id === visit.id ? { ...existing, ...visit } : existing)),
    }))
  }

  async function addBox(title) {
    const { box } = await api('/api/boxes', { method: 'POST', body: { title } })
    setJournal((current) => ({ ...current, boxes: [...current.boxes, box] }))
    return box.id
  }

  // Rename, describe or recolour a box: { title?, description?, color? }
  async function updateBox(id, changes) {
    const { box } = await api(`/api/boxes/${id}`, { method: 'PATCH', body: changes })
    setJournal((current) => ({ ...current, boxes: current.boxes.map((existing) => (existing.id === id ? box : existing)) }))
    return box
  }

  function setBoxStickers(id, stickers) {
    setJournal((current) => ({
      ...current,
      boxes: current.boxes.map((box) => (box.id === id ? { ...box, stickers } : box)),
    }))
  }

  async function setRestaurantCategory(id, category) {
    const { restaurant } = await api(`/api/restaurants/${id}`, { method: 'PATCH', body: { category } })
    setJournal((current) => ({
      ...current,
      restaurants: current.restaurants.map((existing) => (existing.id === id ? restaurant : existing)),
      visits: current.visits.map((visit) =>
        visit.restaurantId === id ? { ...visit, restaurant: { ...visit.restaurant, category: restaurant.category } } : visit,
      ),
    }))
    return restaurant
  }

  async function shareVisit(id, isPublic) {
    await api(`/api/visits/${id}`, { method: 'PATCH', body: { isPublic } })
    setJournal((current) => ({ ...current, visits: current.visits.map((visit) => visit.id === id ? { ...visit, isPublic } : visit) }))
  }

  async function addToBox(boxId, restaurantId) {
    const { box } = await api(`/api/boxes/${boxId}/restaurants`, { method: 'POST', body: { restaurantId } })
    setJournal((current) => ({
      ...current,
      boxes: current.boxes.map((existing) => (existing.id === box.id ? box : existing)),
    }))
  }

  async function addSticker(blob, style) {
    const sticker = await uploadSticker(blob, style)
    setJournal((current) => ({ ...current, stickers: [sticker, ...current.stickers] }))
    return sticker
  }

  async function deleteSticker(id) {
    await api(`/api/stickers/${id}`, { method: 'DELETE' })
    forgetSticker(id)
    setJournal((current) => ({
      ...current,
      stickers: current.stickers.filter((sticker) => sticker.id !== id),
      boxes: current.boxes.map((box) => ({ ...box, stickers: withoutSticker(box.stickers, id) })),
      visits: current.visits.map((visit) => ({
        ...visit,
        stickers: withoutSticker(visit.stickers, id),
        dishes: visit.dishes.map((dish) => (dish.sticker?.stickerId === id ? { ...dish, sticker: null } : dish)),
      })),
    }))
  }

  if (status === 'loading') {
    return (
      <JournalMessage>
        <p role="status" className="uppercase tracking-widest">
          Opening your journal…
        </p>
      </JournalMessage>
    )
  }

  if (status === 'error') {
    return (
      <JournalMessage>
        <p role="alert" className="text-brand">
          Could not load your journal: {loadError}
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus('loading')
            setAttempt((count) => count + 1)
          }}
          className="mt-4 font-semibold text-accent underline hover:text-accent-dark"
        >
          Try again
        </button>
      </JournalMessage>
    )
  }

  const value = {
    ...journal,
    addVisit,
    updateVisit,
    addBox,
    updateBox,
    setBoxStickers,
    addToBox,
    shareVisit,
    setRestaurantCategory,
    addSticker,
    deleteSticker,
  }
  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>
}
