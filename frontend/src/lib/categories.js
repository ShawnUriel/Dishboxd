// Restaurant categories. Any short name works; these are suggested while typing.
export const CATEGORY_SUGGESTIONS = [
  'Cafe',
  'Coffee shop',
  'Matcha bar',
  'Milk tea',
  'Bakery',
  'Dessert',
  'Filipino',
  'Italian',
  'Japanese',
  'Korean',
  'Chinese',
  'Thai',
  'Vietnamese',
  'Indian',
  'Mexican',
  'American',
  'Burgers',
  'Pizza',
  'Fast food',
  'Samgyupsal',
  'Ramen',
  'Sushi',
  'Seafood',
  'Steakhouse',
  'Barbecue',
  'Breakfast & brunch',
  'Bar',
  'Food court',
  'Street food',
  'Vegetarian',
]

// One-tap choices on the ticket
export const QUICK_CATEGORIES = ['Cafe', 'Matcha bar', 'Coffee shop', 'Bakery', 'Filipino', 'Italian', 'Japanese', 'Korean', 'Fast food', 'Dessert']

export const UNSORTED = 'Not sorted yet'

export function categoryName(restaurant) {
  return restaurant?.category?.trim() || UNSORTED
}

// Categories in use, most restaurants first, "Not sorted yet" last: [{ name, count }]
export function categoryCounts(restaurants) {
  const counts = new Map()
  for (const restaurant of restaurants) {
    const name = categoryName(restaurant)
    counts.set(name, (counts.get(name) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => (a.name === UNSORTED) - (b.name === UNSORTED) || b.count - a.count || a.name.localeCompare(b.name))
}
