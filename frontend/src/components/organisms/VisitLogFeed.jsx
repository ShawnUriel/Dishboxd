import VisitLogCard from '../molecules/VisitLogCard.jsx'

// A list of past visits. Pass restaurantsById to show restaurant names (Home);
// leave it out for a single restaurant's visit history.
export default function VisitLogFeed({ visits, restaurantsById, emptyMessage }) {
  if (visits.length === 0) {
    return <p className="py-6 font-mono text-sm text-muted">{emptyMessage}</p>
  }

  return (
    <ul>
      {visits.map((visit) => (
        <VisitLogCard key={visit.id} visit={visit} restaurant={restaurantsById?.get(visit.restaurantId)} />
      ))}
    </ul>
  )
}
