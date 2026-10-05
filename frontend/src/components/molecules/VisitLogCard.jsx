import { Link } from 'react-router-dom'
import Leader from '../atoms/Leader.jsx'
import RatingCircle from '../atoms/RatingCircle.jsx'
import Photo from '../atoms/Photo.jsx'
import ScoreBadge from '../atoms/ScoreBadge.jsx'
import StickerImage from '../atoms/StickerImage.jsx'
import { formatDate, formatMoney } from '../../lib/format.js'
import { isOnFire, reviewOnFire } from '../../lib/scores.js'
import { visitTotal } from '../../lib/stats.js'

// One past visit.
// With a restaurant (Home log): name as the title, date underneath.
// Without one (restaurant's visit history): date as the title.
// Either way, every item is listed with its own score and note.
export default function VisitLogCard({ visit, restaurant }) {
  return (
    <li className="flex items-start gap-4 border-b border-dashed border-line py-4 last:border-b-0">
      <RatingCircle value={visit.rating} decimals={restaurant ? 1 : 0} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          {restaurant ? (
            <Link
              to={`/restaurant/${restaurant.id}`}
              className="font-serif text-xl font-semibold hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
            >
              {restaurant.name}
            </Link>
          ) : (
            <span className="font-mono text-sm text-muted">{formatDate(visit.date)}</span>
          )}
          {reviewOnFire(visit) && <span className="fire-stamp">On fire</span>}
          <Leader />
          <span className="font-mono text-sm text-muted">{formatMoney(visitTotal(visit))}</span>
        </div>
        {restaurant && <p className="mt-1 font-mono text-sm text-muted">{formatDate(visit.date)}</p>}
        <ul className="mt-2 space-y-1.5">
          {visit.dishes.map((dish, index) => (
            <li
              key={dish.id ?? `${dish.name}-${index}`}
              className={`flex items-start gap-2 rounded-md px-1.5 py-1 font-mono text-sm ${isOnFire(dish.score) ? 'dish-line-fire' : ''}`}
            >
              <span className="min-w-0 flex-1 break-words">
                {dish.name}
                {dish.description && (
                  <span className="mt-0.5 block text-xs italic leading-5 text-muted">“{dish.description}”</span>
                )}
              </span>
              <ScoreBadge score={dish.score} size="sm" />
              {dish.sticker && (
                <span className="w-7 shrink-0" style={{ transform: `rotate(${dish.sticker.rotation}deg)` }}>
                  <StickerImage id={dish.sticker.stickerId} className="w-full" />
                </span>
              )}
            </li>
          ))}
        </ul>
        {visit.notes && (
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">{visit.notes}</p>
        )}
        {visit.photoIds?.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {visit.photoIds.map((id, index) => (
              <Photo
                key={id}
                id={id}
                alt={`Photo from the visit, ${index + 1}`}
                className="aspect-[4/3] w-full rounded-md"
              />
            ))}
          </div>
        )}
      </div>
    </li>
  )
}
