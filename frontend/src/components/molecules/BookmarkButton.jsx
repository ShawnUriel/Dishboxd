import { useState } from 'react'
import { useJournal } from '../../state/useJournal.js'

const normalize = (value = '') => value.trim().toLowerCase().replace(/\s+/g, ' ')
export default function BookmarkButton({ place, restaurantId, className = '' }) {
  const { bookmarks, saveBookmark, removeBookmark } = useJournal()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const saved = bookmarks.find((item) => place.placeId
    ? item.placeId === place.placeId
    : !item.placeId && normalize(item.name) === normalize(place.name) && normalize(item.address) === normalize(place.address))
  async function toggle() {
    setBusy(true)
    setError('')
    try {
      if (saved) await removeBookmark(saved.id)
      else await saveBookmark(restaurantId ? { restaurantId } : place)
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  return <span className={`relative z-20 inline-flex flex-col items-start gap-1 ${className}`}>
    <button type="button" aria-pressed={Boolean(saved)} disabled={busy} onClick={toggle}
      className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs disabled:opacity-50 ${saved ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-card text-muted hover:border-accent'}`}>
      <svg aria-hidden="true" width="14" height="16" viewBox="0 0 16 20" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5"><path d="M3 2h10v16l-5-3-5 3V2Z" /></svg>
      {busy ? 'Saving…' : saved ? 'Saved to want to try' : 'Want to try'}
    </button>
    {error && <span role="alert" className="text-xs text-brand">{error}</span>}
  </span>
}
