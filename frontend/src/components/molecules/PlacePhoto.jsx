import { useEffect, useRef, useState } from 'react'
import Photo from '../atoms/Photo.jsx'
import { api } from '../../lib/api.js'

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
  const [result, setResult] = useState(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

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

  useEffect(() => {
    if (!visible) return
    const controller = new AbortController()
    api(`/api/places/${encodeURIComponent(place.placeId)}/photo`, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setResult(data)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => controller.abort()
  }, [place.placeId, visible, attempt])

  const photo = failed ? null : result?.photo
  const mapsUrl = photo?.sourceUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${encodeURIComponent(place.placeId)}`

  function retry() {
    setResult(null)
    setFailed(false)
    setAttempt((value) => value + 1)
  }

  return (
    <figure ref={frame} className="w-24 shrink-0 sm:w-32">
      {photo ? (
        <img src={photo.url} alt={`${place.name} on Google Maps`} onError={() => setFailed(true)} className="aspect-square w-full rounded-lg object-cover" />
      ) : (
        <PhotoPlaceholder name={place.name} loading={visible && !result && !failed} />
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
        ) : result ? 'No photo available' : 'Finding photo…'}
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
