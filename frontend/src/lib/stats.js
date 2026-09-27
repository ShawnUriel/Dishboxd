// Numbers worked out from visits (nothing here is stored).

export function visitTotal(visit) {
  return visit.dishes.reduce((sum, dish) => sum + (Number(dish.price) || 0), 0)
}

export function averageRating(visits) {
  if (visits.length === 0) return null
  return visits.reduce((sum, visit) => sum + visit.rating, 0) / visits.length
}

// Dishes ordered most often at one restaurant, e.g. [{ name, count: 3 }]
export function topDishes(visits, limit = 3) {
  const counts = new Map()
  for (const visit of visits) {
    for (const dish of visit.dishes) {
      counts.set(dish.name, (counts.get(dish.name) || 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export function newestFirst(a, b) {
  return b.date.localeCompare(a.date)
}
