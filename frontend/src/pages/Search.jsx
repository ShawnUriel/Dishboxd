import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import SearchAutocomplete from '../components/organisms/SearchAutocomplete.jsx'

// "Card Catalog": find a restaurant, then either open its record or start a ticket.
export default function Search() {
  const navigate = useNavigate()
  // Home's "By category" links open the catalog on one category
  const [params] = useSearchParams()

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
      <Link to="/bookmarks" className="mt-3 inline-block text-xs text-accent underline">Your want-to-try list →</Link>
      <div className="mt-5">
        <SearchAutocomplete onSelect={handleSelect} initialCategory={params.get('category') ?? ''} />
      </div>
      <p className="mt-8 font-mono text-sm text-muted">
        Choose a restaurant to log a visit, or open one already in your journal. Can’t find your place? Add it yourself from the NEW card.
      </p>
    </>
  )
}
