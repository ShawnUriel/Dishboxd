import { Link } from 'react-router-dom'
import Leader from '../atoms/Leader.jsx'
import RatingCircle from '../atoms/RatingCircle.jsx'
import Photo from '../atoms/Photo.jsx'
import { formatDate, formatMoney } from '../../lib/format.js'
import { visitTotal } from '../../lib/stats.js'

// One past visit.
// With a restaurant (Home log): name as the title, "date · dishes" underneath.
// Without one (restaurant's visit history): date as the title, dishes underneath.
export default function VisitLogCard({ visit, restaurant }) {
  const dishNames = visit.dishes.map((dish) => dish.name)
  const meta = restaurant ? [formatDate(visit.date), ...dishNames] : dishNames

  return (
    <li className="flex items-center gap-4 border-b border-dashed border-line py-4 last:border-b-0">
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
          <Leader />
          <span className="font-mono text-sm text-muted">{formatMoney(visitTotal(visit))}</span>
        </div>
        <p className="mt-1 font-mono text-sm text-muted">{meta.join(' · ')}</p>
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
