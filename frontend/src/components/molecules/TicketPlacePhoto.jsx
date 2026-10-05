import { useState } from 'react'
import { useGooglePlacePhoto } from '../../lib/useGooglePlacePhoto.js'

// The restaurant's Google Maps photo across the top of the entry ticket, when Google has one.
// While it loads, or when there is none, nothing is shown and the ticket looks as before.
export default function TicketPlacePhoto({ placeId, name }) {
  const { photo } = useGooglePlacePhoto(placeId, { size: 'large' })
  const [broken, setBroken] = useState(false)
  if (!photo || broken) return null
  const mapsUrl = photo.sourceUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(placeId)}`
  return (
    <figure className="page-enter border-b border-dashed border-line">
      <img
        src={photo.url}
        alt={`${name}, from Google Maps`}
        onError={() => setBroken(true)}
        className="aspect-[16/7] w-full object-cover"
      />
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 px-6 py-2 text-[10px] leading-5 text-muted sm:px-8">
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" translate="no" className="font-sans text-[11px] text-[#5e5e5e] underline underline-offset-2">
          Google Maps
        </a>
        {photo.attributions?.map((author, index) => (
          <span key={`${author.name}-${index}`}>
            Photo:{' '}
            {author.url ? (
              <a href={author.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                {author.name}
              </a>
            ) : (
              author.name
            )}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}
