import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ReviewCard from '../components/molecules/ReviewCard.jsx'
import { api } from '../lib/api.js'
import { authClient } from '../lib/auth.js'
import { useJournal } from '../state/useJournal.js'

// One review on its own page: where shared links land
export default function ReviewPage() {
  const { id } = useParams()
  return <ReviewContent key={id} id={id} />
}

function ReviewContent({ id }) {
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const { updateVisit, shareVisit } = useJournal()
  const [review, setReview] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api(`/api/reviews/${id}`)
      .then((data) => active && setReview(data.review))
      .catch((failure) =>
        active && setError(failure.status === 404 ? 'This review is private, or no longer shared.' : failure.message),
      )
    return () => {
      active = false
    }
  }, [id])

  const own = review?.author?.id === session?.user.id

  function changed(partial) {
    setReview((current) => ({ ...current, ...partial }))
    if (own) updateVisit(partial)
  }

  async function share(visitId, isPublic) {
    await shareVisit(visitId, isPublic)
    setReview((current) => ({ ...current, isPublic }))
  }

  return (
    <div className="page-enter mx-auto max-w-2xl">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
        className="mb-6 text-xs uppercase tracking-wider text-accent"
      >
        ← Back
      </button>
      {review ? (
        <ReviewCard
          review={review}
          own={own}
          showAuthor
          currentUserId={session?.user.id}
          onChange={changed}
          onShare={own ? share : undefined}
        />
      ) : error ? (
        <div className="paper-card p-8">
          <h1 className="font-serif text-3xl font-semibold">Nothing on this plate.</h1>
          <p role="alert" className="mt-3 text-sm leading-7 text-muted">
            {error}
          </p>
          <Link to="/" className="mt-5 inline-block text-sm text-accent underline underline-offset-4">
            Back to the log →
          </Link>
        </div>
      ) : (
        <p role="status" className="paper-card p-8 text-sm text-muted">
          Bringing the review to the table…
        </p>
      )}
    </div>
  )
}
