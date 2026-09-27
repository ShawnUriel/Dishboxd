import { Link } from 'react-router-dom'
import Leader from '../atoms/Leader.jsx'
import RatingCircle from '../atoms/RatingCircle.jsx'

// One restaurant row inside an open box: rating, name ..... address
export default function RestaurantCard({ restaurant, rating }) {
  return (
    <li className="border-b border-dashed border-line last:border-b-0">
      <Link
        to={`/restaurant/${restaurant.id}`}
        className="group flex items-center gap-4 py-4 focus-visible:outline-2 focus-visible:outline-brand"
      >
        <RatingCircle value={rating} size="sm" />
        <span className="font-serif text-lg font-semibold group-hover:text-brand">{restaurant.name}</span>
        <Leader />
        {restaurant.address && <span className="font-mono text-sm text-muted">{restaurant.address}</span>}
      </Link>
    </li>
  )
}
