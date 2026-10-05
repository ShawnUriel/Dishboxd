import { useEffect, useState } from 'react'
import { api } from './api.js'

// The first Google Maps photo of a place, looked up through our server (the key stays there).
// photo is undefined while loading, null when the place has none, or { url, sourceUrl, attributions }.
// size 'large' asks for a wider image, for the banner on the entry ticket.
export function useGooglePlacePhoto(placeId, { enabled = true, size } = {}) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ key: null, photo: undefined, failed: false })
  const key = `${placeId}|${size ?? ''}|${attempt}`

  useEffect(() => {
    if (!placeId || !enabled) return
    const controller = new AbortController()
    const query = size === 'large' ? '?size=large' : ''
    api(`/api/places/${encodeURIComponent(placeId)}/photo${query}`, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key, photo: data.photo, failed: false })
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key, photo: null, failed: true })
      })
    return () => controller.abort()
  }, [placeId, enabled, size, key])

  const current = result.key === key ? result : { photo: undefined, failed: false }
  return { photo: current.photo, failed: current.failed, retry: () => setAttempt((value) => value + 1) }
}
