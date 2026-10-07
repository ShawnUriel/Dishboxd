import { useState } from 'react'
import Button from '../atoms/Button.jsx'
import CodeBadge from '../atoms/CodeBadge.jsx'
import BookmarkButton from './BookmarkButton.jsx'

// NEW card for a restaurant that is not on Google Maps: files the typed name by hand,
// with an optional street address, then moves to the entry ticket.
export default function ManualPlaceForm({ name, onAdd }) {
  const [address, setAddress] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    onAdd({ placeId: null, name: name.trim(), address: address.trim() })
  }

  return (
    <li className="rounded-xl border border-dashed border-line bg-card p-3 md:p-4">
      <form onSubmit={handleSubmit} aria-label={`Add ${name} yourself`}>
        <div className="flex items-center gap-4">
          <CodeBadge code={null} />
          <div className="min-w-0">
            <p className="font-serif text-lg font-semibold break-words">{name}</p>
            <p className="font-mono text-sm text-muted">Not on Google Maps? Add it yourself.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="font-mono text-xs uppercase tracking-widest text-muted">
              Street address (optional)
            </span>
            <input
              type="text"
              value={address}
              maxLength={120}
              autoComplete="off"
              onChange={(event) => setAddress(event.target.value)}
              className="mt-1 w-full border-b border-dotted border-muted bg-transparent font-mono text-sm focus:border-solid focus:border-brand focus:outline-none"
            />
          </label>
          <Button type="submit" size="sm">
            Start ticket
          </Button>
          <BookmarkButton place={{ name: name.trim(), address: address.trim() }} />
        </div>
      </form>
    </li>
  )
}
