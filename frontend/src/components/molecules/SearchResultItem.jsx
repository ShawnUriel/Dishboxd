import { useId } from 'react'
import CategoryTag from '../atoms/CategoryTag.jsx'
import CodeBadge from '../atoms/CodeBadge.jsx'
import PlacePhoto from './PlacePhoto.jsx'
import Tag from '../atoms/Tag.jsx'
import { restaurantCode } from '../../lib/format.js'

// One catalog card in the search results. `restaurant` is set when it is already ON FILE;
// `exact` marks the Google result whose name is exactly what was typed.
export default function SearchResultItem({ place, restaurant, photoId, onSelect, exact = false }) {
  const labelId = useId()
  return (
    <li className="paper-lift relative rounded-xl border border-b-4 border-card-edge bg-card shadow-sm">
      <button
        type="button"
        onClick={() => onSelect(place, restaurant)}
        aria-labelledby={labelId}
        aria-describedby={`${labelId}-action`}
        className="absolute inset-0 z-10 w-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <span id={`${labelId}-action`} className="sr-only">{restaurant ? 'Open its record' : 'Start a new entry'}</span>
      </button>
      <div className="flex items-start gap-4 p-4 sm:gap-6 sm:p-5">
        <PlacePhoto place={place} photoId={photoId} />
        <div className="min-w-0 flex-1 py-1">
          <CategoryTag category={restaurant?.category || place.category} className="mb-1.5" />
          <h3 id={labelId} className="break-words font-serif text-xl font-semibold leading-snug sm:text-2xl">{place.name}</h3>
          {place.address && <p className="mt-2 break-words text-xs leading-6 text-muted sm:text-sm">{place.address}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <CodeBadge code={restaurant ? restaurantCode(restaurant.number, true) : null} />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">{restaurant ? 'Open record' : 'Log a visit'} <span aria-hidden="true">↗</span></span>
          </div>
        </div>
      </div>
      {restaurant ? <Tag>On file</Tag> : exact && <Tag>Exact match</Tag>}
    </li>
  )
}
