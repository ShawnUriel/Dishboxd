import { useEffect, useState } from 'react'
import { api } from './api.js'
import { passportCuisine } from './passport.js'

export function useTicketCuisine({ placeId, placeKey, suggested, category }) {
  const [choice, setChoice] = useState(null)
  const [lookup, setLookup] = useState(null)
  useEffect(() => {
    if (!placeId || suggested) return
    const controller = new AbortController()
    api(`/api/places/${encodeURIComponent(placeId)}/cuisine`, { signal: controller.signal })
      .then(({ cuisine }) => { if (!controller.signal.aborted) setLookup({ placeId, cuisine, error: false }) })
      .catch(() => { if (!controller.signal.aborted) setLookup({ placeId, cuisine: '', error: true }) })
    return () => controller.abort()
  }, [placeId, suggested])
  const result = lookup?.placeId === placeId ? lookup : null
  const manual = choice?.key === placeKey
  const detected = suggested || result?.cuisine || ''
  const loading = Boolean(placeId && !suggested && !result && !manual)
  const value = manual ? choice.value : detected || passportCuisine(category)
  const hint = manual ? 'Your choice takes priority. Save your review to update your passport.'
    : loading ? 'Checking Google for a cuisine suggestion… You can also choose one yourself.'
    : detected ? 'Suggested by Google. Keep it or choose another cuisine for this meal.'
    : result?.error ? 'Google could not check this place. Choose a cuisine or leave it blank.'
    : value ? 'Suggested from this restaurant’s category. You can change it for this meal.'
    : placeId ? 'Google did not identify a cuisine. Choose one yourself or leave it blank.'
    : 'Choose a Google restaurant to suggest its cuisine, or add your own tag.'
  return { value, loading, hint, onChange: value => setChoice({ key: placeKey, value }) }
}
