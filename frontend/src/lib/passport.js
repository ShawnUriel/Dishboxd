// Cuisine stamps are earned from saved reviews, never from bookmarks or unvisited places.
// Explicit aliases recognise cuisine-specific categories without guessing from a dish/name.
export const CUISINES = [
  { id: 'filipino', name: 'Filipino', aliases: ['filipino', 'philippine', 'pinoy'], icon: 'plate', color: '#8c2f2f' },
  { id: 'japanese', name: 'Japanese', aliases: ['japanese', 'ramen', 'sushi', 'izakaya'], icon: 'noodles', color: '#45687e' },
  { id: 'korean', name: 'Korean', aliases: ['korean', 'samgyupsal', 'korean bbq'], icon: 'grill', color: '#9b5333' },
  { id: 'italian', name: 'Italian', aliases: ['italian', 'pizzeria'], icon: 'pizza', color: '#527158' },
  { id: 'chinese', name: 'Chinese', aliases: ['chinese', 'dim sum', 'cantonese', 'sichuan'], icon: 'dumpling', color: '#8c2f2f' },
  { id: 'thai', name: 'Thai', aliases: ['thai'], icon: 'bowl', color: '#8a6125' },
  { id: 'vietnamese', name: 'Vietnamese', aliases: ['vietnamese', 'pho'], icon: 'noodles', color: '#527158' },
  { id: 'indian', name: 'Indian', aliases: ['indian'], icon: 'bowl', color: '#9b5333' },
  { id: 'mexican', name: 'Mexican', aliases: ['mexican', 'taqueria'], icon: 'taco', color: '#527158' },
  { id: 'american', name: 'American', aliases: ['american', 'american diner'], icon: 'burger', color: '#45687e' },
  { id: 'french', name: 'French', aliases: ['french'], icon: 'croissant', color: '#8c2f2f' },
  { id: 'mediterranean', name: 'Mediterranean', aliases: ['mediterranean', 'greek', 'levantine'], icon: 'olive', color: '#527158' },
]

export function passportCuisine(value) {
  const normalized = (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s+cuisine$/, '')
  return CUISINES.find(cuisine => cuisine.aliases.includes(normalized))?.name || ''
}

export function collectPassport(visits, restaurants) {
  const places = new Map(restaurants.map(place => [place.id, place]))
  return CUISINES.map(cuisine => {
    const matches = visits.filter(visit => {
      const tag = visit.cuisine ?? places.get(visit.restaurantId)?.category ?? visit.restaurant?.category ?? ''
      return passportCuisine(tag) === cuisine.name
    }).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    return { ...cuisine, earned: matches.length > 0, firstVisit: matches[0], visits: matches.length }
  })
}
