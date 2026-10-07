import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import ReviewCard from '../components/molecules/ReviewCard.jsx'
import ReviewComments from '../components/organisms/ReviewComments.jsx'
import Button from '../components/atoms/Button.jsx'
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
  const { hash } = useLocation()
  const { data: session } = authClient.useSession()
  const { updateVisit, shareVisit, deleteVisit } = useJournal()
  const [review, setReview] = useState(null)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  useEffect(() => {
    if (!review || hash !== '#comments') return
    const frame = requestAnimationFrame(() => document.getElementById('comments')?.scrollIntoView({ block: 'start' }))
    return () => cancelAnimationFrame(frame)
  }, [review?.id, hash])

  function changed(partial) {
    setReview((current) => ({ ...current, ...partial }))
    if (own) updateVisit({ id, ...partial })
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
        <>
        <ReviewCard
          review={review}
          own={own}
          showAuthor
          currentUserId={session?.user.id}
          onChange={changed}
          onShare={own ? share : undefined}
        />
        {own && <section className="mt-5 flex flex-wrap items-center gap-4 text-xs">
          <Link to={`/review/${id}/edit`} className="text-accent underline">Edit review</Link>
          <button type="button" disabled={deleting} className="text-brand underline" onClick={() => setConfirmDelete(true)}>Delete review</button>
          {confirmDelete && <div role="group" aria-label="Confirm review deletion" className="paper-card w-full space-y-3 p-5">
            <p className="text-sm leading-6">Delete this review permanently? Its photos, comments, likes and reposts will also be removed. The restaurant stays in your journal.</p>
            <div className="flex gap-3"><Button size="sm" disabled={deleting} onClick={async () => {
              setDeleting(true); setError('')
              try { await deleteVisit(id); navigate('/', { replace: true }) }
              catch (failure) { setError(failure.message); setDeleting(false) }
            }}>{deleting ? 'Deleting…' : 'Yes, delete review'}</Button><Button size="sm" variant="secondary" disabled={deleting} onClick={() => setConfirmDelete(false)}>Keep review</Button></div>
          </div>}
          {error && <p role="alert" className="w-full text-brand">{error}</p>}
        </section>}
        <ReviewComments review={review} currentUserId={session?.user.id} onCountChange={(commentCount) => changed({ commentCount })} />
        </>
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
