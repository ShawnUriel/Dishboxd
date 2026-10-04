import CodeBadge from '../atoms/CodeBadge.jsx'
import PhotoThumbnail from '../atoms/PhotoThumbnail.jsx'
import Tag from '../atoms/Tag.jsx'
import { restaurantCode } from '../../lib/format.js'

// One catalog card in the search results. `restaurant` is set when it is already ON FILE;
// `exact` marks the Google result whose name is exactly what was typed.
export default function SearchResultItem({ place, restaurant, onSelect, exact = false }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(place, restaurant)}
        className="relative flex w-full items-center gap-4 rounded-xl border border-b-4 border-card-edge bg-card p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand md:p-4"
      >
        <PhotoThumbnail className="size-16 rounded-lg md:size-24" />
        <span className="w-0.5 self-stretch bg-card-edge" aria-hidden="true" />
        <CodeBadge code={restaurant ? restaurantCode(restaurant.number, true) : null} />
        <span className="min-w-0">
          <span className="block font-serif text-lg font-semibold">{place.name}</span>
          {place.address && <span className="block font-mono text-sm text-muted">{place.address}</span>}
        </span>
        {restaurant ? <Tag>On file</Tag> : exact && <Tag>Exact match</Tag>}
        <span className="sr-only">{restaurant ? 'Open its record' : 'Start a new entry'}</span>
      </button>
    </li>
  )
}
