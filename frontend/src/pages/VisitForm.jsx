import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import Button from '../components/atoms/Button.jsx'
import StarRating from '../components/atoms/StarRating.jsx'
import DishEntryList from '../components/organisms/DishEntryList.jsx'
import { newDish } from '../lib/dishes.js'
import { formatDate, todayIso } from '../lib/format.js'
import { useJournal } from '../state/useJournal.js'

// "Dishboxd Ticket": log one visit and its dishes for the restaurant picked on Search.
export default function VisitForm() {
  const place = useLocation().state?.place
  const navigate = useNavigate()
  const { addVisit } = useJournal()
  const [rating, setRating] = useState(0)
  const [dishes, setDishes] = useState(() => [newDish(), newDish()])
  const [notes, setNotes] = useState('')
  const [triedSubmit, setTriedSubmit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const date = todayIso()

  // The ticket needs a restaurant, so without one go back to the search.
  if (!place) return <Navigate to="/search" replace />


  const filledDishes = dishes
    .filter((dish) => dish.name.trim())
    .map((dish) => ({
      name: dish.name.trim(),
      price: Math.min(Math.max(Number(dish.price) || 0, 0), 10000),
    }))

  // Checked on every render, but only shown after the first submit attempt,
  // so the message disappears as soon as the problem is fixed.
  let problem = ''
  if (!rating) problem = 'Pick an overall rating (1 to 5 stars).'
  else if (filledDishes.length === 0) problem = 'Add at least one dish.'
  const error = (triedSubmit ? problem : '') || saveError

  async function handleSubmit(event) {
    event.preventDefault()
    setTriedSubmit(true)
    setSaveError('')
    if (problem || saving) return

    setSaving(true)
    try {
      const restaurantId = await addVisit(place, { date, rating, notes: notes.trim(), dishes: filledDishes })
      navigate(`/restaurant/${restaurantId}`)
    } catch (saveFailure) {
      setSaveError(saveFailure.message)
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby="ticket-title"
      className="mx-auto max-w-[490px] bg-card shadow-lg"
    >
      <header className="border-b border-dashed border-line px-6 py-6 text-center md:px-8">
        <h1 id="ticket-title" className="font-serif text-2xl font-bold uppercase tracking-wide">
          Dishboxd Ticket
        </h1>
        <p className="mt-1 font-mono text-sm text-muted">{place.name}</p>
        <p className="font-mono text-sm uppercase tracking-widest text-muted">{formatDate(date)} · Table for one</p>
      </header>

      <div className="space-y-6 px-6 py-6 md:px-8">
        <div className="flex items-center justify-between gap-4 border-b border-dashed border-line pb-3">
          <span className="font-mono text-sm uppercase tracking-widest text-muted">Overall rating</span>
          <StarRating value={rating} onChange={setRating} label="Overall rating" />
        </div>

        <DishEntryList dishes={dishes} onChange={setDishes} />

        <div>
          <label htmlFor="notes" className="font-mono text-sm uppercase tracking-widest text-muted">
            Notes
          </label>
          <textarea
            id="notes"
            rows={8}
            maxLength={2000}
            value={notes}
            placeholder="Write about the visit…"
            onChange={(event) => setNotes(event.target.value)}
            className="bg-notes mt-2 block w-full resize-y font-mono text-sm placeholder:text-faint placeholder:italic focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="px-6 pb-2 font-mono text-sm text-brand md:px-8">
          {error}
        </p>
      )}

      <footer className="flex gap-3 border-t border-dashed border-line px-6 py-6 md:px-8">
        <Button
          variant="secondary"
          className="w-24 md:w-36"
          onClick={() => navigate('/search')}
        >
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving ? 'Stamping…' : 'Stamp & submit'}
        </Button>
      </footer>
    </form>
  )
}
