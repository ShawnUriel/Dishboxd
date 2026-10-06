import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Button from '../components/atoms/Button.jsx'
import SectionLabel from '../components/atoms/SectionLabel.jsx'
import Stamp from '../components/atoms/Stamp.jsx'
import RestaurantHeader from '../components/organisms/RestaurantHeader.jsx'
import VisitLogFeed from '../components/organisms/VisitLogFeed.jsx'
import { PERFECT } from '../lib/scores.js'
import { averageRating, newestFirst, topDishes } from '../lib/stats.js'
import { useJournal } from '../state/useJournal.js'
import NotFound from './NotFound.jsx'

// One restaurant's record: photo, average rating, top dishes and every visit.
export default function RestaurantProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { restaurants, visits, boxes, addToBox, setRestaurantCategory } = useJournal()
  const [choosingBox, setChoosingBox] = useState(false)
  const [filing, setFiling] = useState(false)
  const [boxError, setBoxError] = useState('')

  const restaurant = restaurants.find((r) => r.id === id)
  if (!restaurant) return <NotFound />

  const history = visits.filter((visit) => visit.restaurantId === id).sort(newestFirst)
  const favourites = topDishes(history)
  // The ticket sends this restaurant's id, so the visit is filed under it
  const place = { restaurantId: restaurant.id, placeId: restaurant.placeId, name: restaurant.name, address: restaurant.address }

  async function fileInBox(boxId) {
    setFiling(true)
    setBoxError('')
    try {
      await addToBox(boxId, id)
      navigate(`/lists/${boxId}`)
    } catch (saveFailure) {
      setBoxError(saveFailure.message)
      setFiling(false)
    }
  }

  return (
    <div className="md:grid md:min-h-[calc(100vh-6rem)] md:grid-cols-[minmax(0,24rem)_1fr]">
      <aside className="flex flex-col md:border-r md:border-dashed md:border-line md:pr-10">
        <RestaurantHeader
          restaurant={restaurant}
          rating={averageRating(history)}
          photoId={history.find((visit) => visit.photoIds?.length)?.photoIds[0]}
          onSaveCategory={(category) => setRestaurantCategory(restaurant.id, category)}
        />

        <hr className="my-6 border-dashed border-line" />
        <SectionLabel>Top dishes</SectionLabel>
        <ul className="mt-3 space-y-1.5 font-mono text-sm">
          {favourites.map((dish) => (
            <li key={dish.name} className="flex justify-between gap-4">
              <span className="min-w-0 break-words">{dish.name}</span>
              <span className="shrink-0 text-muted">
                ×{dish.count}
                {dish.score != null && (
                  <span className={dish.score > PERFECT ? 'ml-2 font-semibold text-[#c2410c]' : 'ml-2'}>
                    {Number.isInteger(dish.score) ? dish.score : dish.score.toFixed(1)}/10
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-10 md:mt-auto md:pt-10">
          {choosingBox ? (
            <div className="rounded-md border border-line bg-card p-4">
              <SectionLabel as="p">File in which box?</SectionLabel>
              {boxes.length === 0 && (
                <p className="mt-3 font-mono text-sm text-muted">
                  No boxes yet.{" "}
                  <Link to="/lists" className="text-accent underline hover:text-accent-dark">
                    Make one in Collections
                  </Link>
                  .
                </p>
              )}
              <ul className="mt-3 space-y-2">
                {boxes.map((box) => {
                  const alreadyFiled = box.restaurantIds.includes(id)
                  return (
                    <li key={box.id}>
                      <button
                        type="button"
                        disabled={alreadyFiled || filing}
                        onClick={() => fileInBox(box.id)}
                        className="w-full text-left font-mono text-sm hover:text-brand focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:text-faint"
                      >
                        {box.title}
                        {alreadyFiled && ' (already filed)'}
                      </button>
                    </li>
                  )
                })}
              </ul>
              {boxError && (
                <p role="alert" className="mt-3 font-mono text-sm text-brand">
                  {boxError}
                </p>
              )}
              <button
                type="button"
                onClick={() => setChoosingBox(false)}
                className="mt-4 font-mono text-sm text-muted underline hover:text-ink"
              >
                Cancel
              </button>
            </div>
          ) : (
            <Button variant="accent" className="w-full" onClick={() => setChoosingBox(true)}>
              + File in a box
            </Button>
          )}
        </div>
      </aside>

      <section aria-labelledby="history-label" className="mt-12 md:mt-0 md:pl-12">
        <div className="flex items-center justify-between gap-4">
          <SectionLabel id="history-label">Visit history</SectionLabel>
          <Link
            to="/log/new"
            state={{ place }}
            className="rounded-full transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
          >
            <Stamp shape="smallPill">+ New entry</Stamp>
          </Link>
        </div>
        <div className="mt-2">
          <VisitLogFeed visits={history} emptyMessage="No visits logged yet." />
        </div>
      </section>
    </div>
  )
}
