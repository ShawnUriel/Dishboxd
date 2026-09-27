import { useParams } from 'react-router-dom'
import SectionLabel from '../components/atoms/SectionLabel.jsx'
import Stamp from '../components/atoms/Stamp.jsx'
import RestaurantCard from '../components/molecules/RestaurantCard.jsx'
import { averageRating } from '../lib/stats.js'
import { useJournal } from '../state/useJournal.js'
import NotFound from './NotFound.jsx'

// "Box open": one box and the restaurants filed in it.
export default function ListDetail() {
  const { id } = useParams()
  const { boxes, restaurants, visits } = useJournal()

  const box = boxes.find((b) => b.id === id)
  if (!box) return <NotFound />

  const filed = box.restaurantIds
    .map((restaurantId) => restaurants.find((r) => r.id === restaurantId))
    .filter(Boolean)
  const count = filed.length

  return (
    <>
      {/* Pulled up so the "Box open" tab touches the top edge, as in the design */}
      <p className="clip-trapezoid -mt-8 block w-fit bg-brand px-16 py-3 font-mono text-sm font-semibold uppercase tracking-widest text-white md:-mt-11">
        Box open
      </p>

      <header className="mt-4 flex items-start justify-between gap-4 border-b border-dashed border-line pb-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">{box.title}</h1>
          {box.description && <p className="mt-2 max-w-md font-mono text-sm text-muted">{box.description}</p>}
        </div>
        <Stamp shape="box" className="mt-1 shrink-0">
          {box.isPublic ? 'Public' : 'Private'}
        </Stamp>
      </header>

      <SectionLabel as="p" className="mt-5">
        {count} {count === 1 ? 'restaurant' : 'restaurants'}
      </SectionLabel>

      {count > 0 ? (
        <ul className="mt-2">
          {filed.map((restaurant) => (
            <RestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              rating={averageRating(visits.filter((visit) => visit.restaurantId === restaurant.id))}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-4 font-mono text-sm text-muted">
          This box is empty. Open a restaurant and use + File in a box.
        </p>
      )}
    </>
  )
}
