import { useNavigate } from 'react-router-dom'
import SearchAutocomplete from '../components/organisms/SearchAutocomplete.jsx'

// "Card Catalog": find a restaurant, then either open its record or start a ticket.
export default function Search() {
  const navigate = useNavigate()

  function handleSelect(place, restaurant) {
    if (restaurant) {
      navigate(`/restaurant/${restaurant.id}`)
    } else {
      // Stage the NEW restaurant (from Google, or added by hand) and carry it to the entry ticket
      navigate('/log/new', { state: { place } })
    }
  }

  return (
    <>
      <h1 className="font-serif text-3xl font-bold tracking-tight">Card Catalog</h1>
      <div className="mt-5">
        <SearchAutocomplete onSelect={handleSelect} />
      </div>
      <p className="mt-8 font-mono text-sm text-muted">
        Picking a tray already ON FILE opens its record; a NEW tray stages it and moves to the entry ticket. Not on Google Maps? Add it yourself from the NEW card.
      </p>
    </>
  )
}
