import PhotoThumbnail from '../atoms/PhotoThumbnail.jsx'
import RatingCircle from '../atoms/RatingCircle.jsx'
import Photo from '../atoms/Photo.jsx'
import { restaurantCode } from '../../lib/format.js'

// Polaroid photo, catalog number, name, address and average rating.
export default function RestaurantHeader({ restaurant, rating, photoId }) {
  return (
    <header className="flex flex-col items-center text-center">
      <div className="-rotate-2 bg-white p-1.5 shadow-md">
        {photoId ? (
          <Photo id={photoId} alt={restaurant.name} className="size-40 md:size-44" />
        ) : (
          <PhotoThumbnail className="size-40 md:size-44" />
        )}
      </div>
      <p className="mt-5 font-mono text-sm tracking-widest text-muted">{restaurantCode(restaurant.number)}</p>
      <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight">{restaurant.name}</h1>
      {restaurant.address && <p className="mt-1 font-mono text-sm text-muted">{restaurant.address}</p>}
      {/* Google gives no menus through its API, so a place found on Google links to its Maps page,
          which shows the menu, photos and opening hours when the restaurant has them */}
      {restaurant.placeId && (
        <a
          href={`https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(restaurant.placeId)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 font-mono text-sm text-accent underline underline-offset-4 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Menu &amp; info on Google Maps <span aria-hidden="true">↗</span>
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
      <div className="mt-4">
        <RatingCircle value={rating} size="lg" />
      </div>
    </header>
  )
}
