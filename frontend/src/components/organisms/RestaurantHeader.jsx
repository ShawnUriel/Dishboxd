import PhotoThumbnail from '../atoms/PhotoThumbnail.jsx'
import RatingCircle from '../atoms/RatingCircle.jsx'
import { restaurantCode } from '../../lib/format.js'

// Polaroid photo, catalog number, name, address and average rating.
export default function RestaurantHeader({ restaurant, rating }) {
  return (
    <header className="flex flex-col items-center text-center">
      <div className="-rotate-2 bg-white p-1.5 shadow-md">
        <PhotoThumbnail className="size-40 md:size-44" />
      </div>
      <p className="mt-5 font-mono text-sm tracking-widest text-muted">{restaurantCode(restaurant.number)}</p>
      <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight">{restaurant.name}</h1>
      {restaurant.address && <p className="mt-1 font-mono text-sm text-muted">{restaurant.address}</p>}
      <div className="mt-4">
        <RatingCircle value={rating} size="lg" />
      </div>
    </header>
  )
}
