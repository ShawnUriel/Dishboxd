// Numbers worked out from visits (nothing here is stored).

export function visitTotal(visit) {
  return visit.dishes.reduce((sum, dish) => sum + (Number(dish.price) || 0), 0)
}

export function averageRating(visits) {
  if (visits.length === 0) return null
  return visits.reduce((sum, visit) => sum + visit.rating, 0) / visits.length
}

// Dishes ordered most often at one restaurant, with their average score out of 10 when scored,
// e.g. [{ name, count: 3, score: 9.3 }]. Ties go to the better-scored dish.
export function topDishes(visits, limit = 3) {
  const tally = new Map()
  for (const visit of visits) {
    for (const dish of visit.dishes) {
      const entry = tally.get(dish.name) ?? { name: dish.name, count: 0, total: 0, scored: 0 }
      entry.count++
      if (dish.score != null) {
        entry.total += dish.score
        entry.scored++
      }
      tally.set(dish.name, entry)
    }
  }
  return [...tally.values()]
    .map(({ name, count, total, scored }) => ({ name, count, score: scored ? total / scored : null }))
    .sort((a, b) => b.count - a.count || (b.score ?? -1) - (a.score ?? -1))
    .slice(0, limit)
}

export function newestFirst(a, b) {
  return b.date.localeCompare(a.date)
}

// Dishes already logged at one restaurant, each with the price paid most recently,
// e.g. [{ name: 'Chickenjoy', price: 99 }]. Suggested while typing on a new ticket.
export function dishSuggestions(visits) {
  const latest = new Map()
  for (const visit of [...visits].sort(newestFirst)) {
    for (const dish of visit.dishes) {
      const key = dish.name.toLowerCase()
      if (!latest.has(key)) latest.set(key, { name: dish.name, price: Number(dish.price) || 0 })
    }
  }
  return [...latest.values()]
}
