import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Button from '../components/atoms/Button.jsx'
import TextField from '../components/atoms/TextField.jsx'
import StarRating from '../components/atoms/StarRating.jsx'
import DishEntryList from '../components/organisms/DishEntryList.jsx'
import { api } from '../lib/api.js'
import { authClient } from '../lib/auth.js'
import { todayIso } from '../lib/format.js'
import { useJournal } from '../state/useJournal.js'
import { useSettings } from '../state/useSettings.js'

export default function EditReview() {
  const { id } = useParams()
  return <Editor key={id} id={id} />
}
function Editor({ id }) {
  const { settings } = useSettings()
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const { editVisit } = useJournal()
  const [review, setReview] = useState(null)
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    api(`/api/reviews/${id}`, { signal: controller.signal }).then(({ review: value }) => {
      setReview(value)
      setDraft({ date: value.date, rating: value.rating, notes: value.notes, revision: value.revision, isPublic: value.isPublic, dishes: value.dishes.map((dish) => ({ ...dish, key: dish.id })) })
    }).catch((failure) => { if (!controller.signal.aborted) setError(failure.message) })
    return () => controller.abort()
  }, [id])
  async function save(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      await editVisit(id, draft)
      navigate(`/review/${id}`, { replace: true })
    } catch (failure) { setError(failure.message); setBusy(false) }
  }
  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }))
  return <div className="page-enter mx-auto max-w-2xl">
    <Link to={`/review/${id}`} className="text-xs text-accent underline">← Back to review</Link>
    <h1 className="mt-6 font-serif text-3xl font-semibold">Edit your review</h1>
    {error && <p role="alert" className="my-4 text-sm text-brand">{error}</p>}
    {!review ? !error && <p role="status" className="mt-5 text-sm text-muted">Opening your ticket…</p> : review.author?.id !== session?.user.id ? <p className="mt-5 text-sm text-muted">Only the original author can edit this review.</p> : <form className="paper-card mt-5 p-5 sm:p-8" onSubmit={save}>
      <fieldset disabled={busy} className="space-y-6 disabled:opacity-60">
        <legend className="mb-4 font-serif text-2xl">{review.restaurant.name}</legend>
        <p className="text-xs leading-6 text-muted">Update your food story. Your photos, review stickers and conversation stay with this ticket.</p>
        <TextField id="edit-visit-date" label="Day of your visit" type="date" value={draft.date} max={todayIso()} required onChange={(event) => set('date', event.target.value)} />
        <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs">Overall rating</span><StarRating value={draft.rating} onChange={(value) => set('rating', value)} label="Overall rating" /></div>
        <DishEntryList dishes={draft.dishes} onChange={(value) => set('dishes', value)} />
        <div><label htmlFor="edit-review-notes" className="block text-xs">Your review</label><textarea id="edit-review-notes" value={draft.notes} onChange={(event) => set('notes', event.target.value)} maxLength={2000} rows={6} className="bg-notes mt-2 block w-full rounded-md p-3 text-sm" /></div>
        <label className="flex items-center gap-3 text-xs"><input type="checkbox" checked={draft.isPublic} onChange={(event) => set('isPublic', event.target.checked)} />Share on my profile</label>
        <p className="text-xs leading-6 text-muted">{settings.isPrivate ? 'Shared reviews are visible only to your friends.' : 'Shared reviews are visible to signed-in diners.'} Leave unchecked for “Only me” and an invited co-author, subject to account privacy.</p>
        <div className="flex items-center gap-4"><Button type="submit">{busy ? 'Saving…' : 'Save changes'}</Button><Link to={`/review/${id}`} className="text-xs text-accent underline">Cancel</Link></div>
      </fieldset>
    </form>}
  </div>
}
