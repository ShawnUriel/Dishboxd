import { Link } from 'react-router-dom'

const colors = {
  orange: 'var(--color-box-orange)',
  mint: 'var(--color-box-mint)',
  lavender: 'var(--color-box-lavender)',
  pink: 'var(--color-box-pink)',
  plum: 'var(--color-box-plum)',
}

export default function ListCard({ box, restaurantsById }) {
  const places = box.restaurantIds.map((id) => restaurantsById.get(id)).filter(Boolean)
  const count = places.length
  const preview = places.slice(0, 2).map((restaurant) => restaurant.name).join(' · ')

  return (
    <li className="min-w-0">
      <Link
        to={`/lists/${box.id}`}
        className={`catalog-box group rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand ${box.color === 'plum' ? 'catalog-box-dark' : ''}`}
        style={{ '--folder-color': colors[box.color] || colors.orange }}
        aria-label={`Open ${box.title}, ${count} ${count === 1 ? 'restaurant' : 'restaurants'}`}
      >
        <span className="catalog-box-tab" aria-hidden="true">BOX {String(box.number).padStart(2, '0')}</span>
        <span className="catalog-box-back" aria-hidden="true" />
        <div className="catalog-box-papers" aria-hidden="true">
          <span className="catalog-box-paper-back" />
          <span className="catalog-box-paper-front">
            <span className="truncate">{count ? places[0].name : 'A new favourite belongs here'}</span>
            <span className="shrink-0 text-brand">{count ? 'ON FILE' : 'TO BE FILLED'}</span>
          </span>
        </div>
        <div className={`catalog-box-front ${box.color === 'plum' ? 'text-white' : 'text-ink'}`}>
          <div className="catalog-box-label">
            <div className="mb-3 flex items-center justify-between gap-3 text-[9px] uppercase tracking-[0.15em] text-muted">
              <span>Personal collection</span>
              <span>{box.isPublic ? 'Public' : 'Private'}</span>
            </div>
            <h3 className="line-clamp-2 break-words font-serif text-[27px] font-semibold leading-tight text-ink">{box.title}</h3>
            <p className="mt-3 line-clamp-2 min-h-10 text-[11px] leading-5 text-muted">
              {preview || 'Your next great meal is waiting to be filed.'}
              {count > 2 ? ` · +${count - 2} more` : ''}
            </p>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full border border-current/25 font-medium">{count}</span>
              {count === 1 ? 'restaurant' : 'restaurants'}
            </span>
            <span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider">Open box <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">↗</span></span>
          </div>
        </div>
      </Link>
    </li>
  )
}
