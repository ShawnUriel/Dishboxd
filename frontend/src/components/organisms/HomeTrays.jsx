import { Link } from 'react-router-dom'
import { FolderIcon } from '../atoms/Icon.jsx'
import { boxHex } from '../../lib/colors.js'

export default function HomeTrays({ boxes, visits, restaurantsById }) {
  const recentBoxes = boxes.slice(-3).reverse()
  return (
    <section className="mb-9 mt-8" aria-labelledby="home-tray-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[9px] uppercase tracking-[0.18em] text-muted">A place for every craving</p>
          <h2 id="home-tray-title" className="font-serif text-2xl font-semibold">From your collection</h2>
        </div>
        <Link to="/lists" className="text-xs text-accent underline underline-offset-4">Open your collection <span aria-hidden="true">↗</span></Link>
      </div>
      {recentBoxes.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recentBoxes.map((box) => {
            const ids = new Set(box.restaurantIds)
            const places = box.restaurantIds.map((id) => restaurantsById.get(id)).filter(Boolean)
            const reviewCount = visits.filter((visit) => ids.has(visit.restaurantId)).length
            return (
              <li key={box.id} className="home-tray-card" style={{ '--home-tray-color': boxHex(box.color) }}>
                <div className="mb-3 flex items-center justify-between gap-3 text-[9px] uppercase tracking-wider text-muted">
                  <span className="flex items-center gap-2"><FolderIcon /> In your collection</span>
                  <span>{places.length} {places.length === 1 ? 'place' : 'places'}</span>
                </div>
                <Link to={`/lists/${box.id}`} className="block rounded-sm hover:text-brand">
                  <h3 className="line-clamp-2 break-words font-serif text-xl font-semibold">{box.title}</h3>
                  <p className="mt-2 line-clamp-2 min-h-10 break-words text-[11px] leading-5 text-muted">
                    {box.description || places.slice(0, 2).map((place) => place.name).join(' · ') || 'A little room for your next favourite.'}
                  </p>
                  <span className="mt-3 block text-[10px] text-accent">Open box <span aria-hidden="true">↗</span></span>
                </Link>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-line pt-3">
                  <span className="text-[10px] text-muted">{reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}</span>
                  <Link to="/log/new" state={{ boxId: box.id }} className="rounded-sm text-[11px] font-medium text-brand underline underline-offset-4" aria-label={`Add a review to ${box.title}`}>
                    + Add review
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="home-tray-empty flex flex-col gap-5 rounded-lg border border-dashed border-line p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-start gap-4">
            <span className="mt-1 grid size-10 shrink-0 place-items-center rounded-md border border-card-edge bg-card text-brand" aria-hidden="true"><FolderIcon /></span>
            <div>
              <h3 className="font-serif text-xl font-semibold">Good meals belong somewhere.</h3>
              <p className="mt-2 max-w-lg text-xs leading-6 text-muted">Coffee corners, comfort food, a special occasion. Create a box and choose it when you write your next review.</p>
            </div>
          </div>
          <Link to="/lists" className="shrink-0 text-xs font-medium text-accent underline underline-offset-4">Start your collection <span aria-hidden="true">↗</span></Link>
        </div>
      )}
    </section>
  )
}
