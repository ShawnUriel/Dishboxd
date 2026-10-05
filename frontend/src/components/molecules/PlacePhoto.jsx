import { useEffect, useRef, useState } from 'react'
import Photo from '../atoms/Photo.jsx'
import { useGooglePlacePhoto } from '../../lib/useGooglePlacePhoto.js'

export default function PlacePhoto({ place, photoId }) {
  if (photoId) {
    return (
      <figure className="w-24 shrink-0 sm:w-32">
        <Photo id={photoId} alt={`Your visit to ${place.name}`} className="aspect-square w-full rounded-lg" />
        <figcaption className="mt-2 text-[11px] text-muted">Your photo</figcaption>
      </figure>
    )
  }
  if (place.placeId) return <GooglePlacePhoto key={place.placeId} place={place} />
  return (
    <figure className="w-24 shrink-0 sm:w-32">
      <PhotoPlaceholder name={place.name} />
      <figcaption className="mt-2 text-[11px] leading-5 text-muted">No photo yet</figcaption>
    </figure>
  )
}

function GooglePlacePhoto({ place }) {
  const frame = useRef(null)
  const [visible, setVisible] = useState(false)
  const [brokenImage, setBrokenImage] = useState(false)
  const lookup = useGooglePlacePhoto(place.placeId, { enabled: visible })

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    })
    observer.observe(frame.current)
    return () => observer.disconnect()
  }, [])

  // Looked up only once the card scrolls into view, so a long result list costs nothing extra
  const failed = lookup.failed || brokenImage
  const loaded = lookup.photo !== undefined
  const photo = failed ? null : lookup.photo
  const mapsUrl = photo?.sourceUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${encodeURIComponent(place.placeId)}`

  function retry() {
    setBrokenImage(false)
    lookup.retry()
  }

  return (
    <figure ref={frame} className="w-24 shrink-0 sm:w-32">
      {photo ? (
        <img src={photo.url} alt={`${place.name} on Google Maps`} onError={() => setBrokenImage(true)} className="aspect-square w-full rounded-lg object-cover" />
      ) : (
        <PhotoPlaceholder name={place.name} loading={visible && !loaded && !failed} />
      )}
      <figcaption className="relative z-20 mt-2 space-y-1 break-words text-[11px] leading-5 text-muted">
        {photo ? (
          <>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" translate="no" className="inline-block whitespace-nowrap font-sans text-xs font-normal not-italic tracking-normal text-[#5e5e5e] underline underline-offset-2">Google Maps</a>
            {photo.attributions?.map((author, index) => (
              <span key={`${author.name}-${index}`} className="block">
                Photo: {author.url ? <a href={author.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{author.name}</a> : author.name}
              </span>
            ))}
          </>
        ) : failed ? (
          <>
            <span className="block">Photo unavailable</span>
            <button type="button" onClick={retry} aria-label={`Retry photo for ${place.name}`} className="text-accent underline underline-offset-2">Retry photo</button>
          </>
        ) : loaded ? 'No photo available' : 'Finding photo…'}
      </figcaption>
    </figure>
  )
}

function PhotoPlaceholder({ name, loading = false }) {
  return (
    <div role="img" aria-label={loading ? `Loading a photo of ${name}` : `No photo for ${name}`} className="grid aspect-square w-full place-items-center rounded-lg border border-line bg-sidebar/50 text-muted">
      <svg viewBox="0 0 40 40" className="size-10" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
        <path d="M7 16h26l-3-8H10l-3 8Z" />
        <path d="M9 19v14h22V19M16 33V23h8v10M7 16v2a3 3 0 0 0 6 0 3.5 3.5 0 0 0 7 0 3.5 3.5 0 0 0 7 0 3 3 0 0 0 6 0v-2" />
        <path d="m15 8-2 8m7-8v8m5-8 2 8" />
      </svg>
    </div>
  )
}
