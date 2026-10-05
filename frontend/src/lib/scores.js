// Every item on a ticket gets a score out of 10. Some dishes go past 10 (up to 12),
// and those catch fire. The server allows the same range.
export const PERFECT = 10
export const MAX_SCORE = 12

export function isOnFire(score) {
  return typeof score === 'number' && score > PERFECT
}

// 1 for 11/10, 2 for 12/10: how big the flames are
export function fireLevel(score) {
  return isOnFire(score) ? score - PERFECT : 0
}

// A review burns when any of its items scored past 10
export function reviewOnFire(review) {
  return review.dishes?.some((dish) => isOnFire(dish.score)) ?? false
}

export function hottestScore(review) {
  return Math.max(0, ...(review.dishes ?? []).map((dish) => dish.score ?? 0))
}

const words = [
  [0, 'Never again'],
  [3, 'Not for me'],
  [5, 'It was fine'],
  [7, 'Pretty good'],
  [9, 'Really good'],
  [10, 'Perfect'],
  [11, 'Off the charts'],
  [12, 'Legendary'],
]

// A word for the score: "Perfect" for 10, "Off the charts" for 11...
export function scoreWord(score) {
  if (score == null) return 'Not scored yet'
  return words.find(([limit]) => score <= limit)?.[1] ?? 'Legendary'
}

// Average item score, for a dish ordered more than once
export function averageScore(dishes) {
  const scored = dishes.filter((dish) => dish.score != null)
  if (!scored.length) return null
  return scored.reduce((sum, dish) => sum + dish.score, 0) / scored.length
}
