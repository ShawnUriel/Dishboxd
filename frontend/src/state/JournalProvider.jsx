import { useState } from 'react'
import { JournalContext } from './journalContext.js'

const sameText = (a = '', b = '') => a.trim().toLowerCase() === b.trim().toLowerCase()

// Holds restaurants, visits and boxes for the whole app. It starts empty.
// For now it lives in memory (a page refresh clears it); PostgreSQL replaces this later.
export function JournalProvider({ children }) {
  const [restaurants, setRestaurants] = useState([])
  const [visits, setVisits] = useState([])
  const [boxes, setBoxes] = useState([])

  // A place from Google has a placeId. One added by hand has placeId null,
  // so it is matched on name + address instead.
  function findRestaurant(place) {
    if (place.placeId) return restaurants.find((r) => r.placeId === place.placeId)
    return restaurants.find((r) => !r.placeId && sameText(r.name, place.name) && sameText(r.address, place.address))
  }

  // Saves one ticket: files the restaurant if it is NEW, then adds the visit.
  // Returns the restaurant id so the caller can open its profile.
  function addVisit(place, { date, rating, notes, dishes }) {
    let restaurant = findRestaurant(place)

    if (!restaurant) {
      const number = Math.max(0, ...restaurants.map((r) => r.number)) + 1
      restaurant = {
        id: `r-${crypto.randomUUID()}`,
        number,
        placeId: place.placeId ?? null,
        name: place.name.trim(),
        address: (place.address ?? '').trim(),
      }
      setRestaurants((current) => [...current, restaurant])
    }

    const visit = { id: `v-${crypto.randomUUID()}`, restaurantId: restaurant.id, date, rating, notes, dishes }
    setVisits((current) => [visit, ...current])
    return restaurant.id
  }

  function addBox(title) {
    const colors = ['orange', 'mint', 'lavender', 'pink', 'plum']
    const box = {
      id: `b-${crypto.randomUUID()}`,
      title,
      description: '',
      isPublic: false,
      color: colors[boxes.length % colors.length],
      restaurantIds: [],
    }
    setBoxes((current) => [...current, box])
    return box.id
  }

  function addToBox(boxId, restaurantId) {
    setBoxes((current) =>
      current.map((box) =>
        box.id === boxId && !box.restaurantIds.includes(restaurantId)
          ? { ...box, restaurantIds: [...box.restaurantIds, restaurantId] }
          : box,
      ),
    )
  }

  const value = { restaurants, visits, boxes, addVisit, addBox, addToBox }
  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>
}
