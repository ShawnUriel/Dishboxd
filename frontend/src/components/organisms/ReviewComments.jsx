import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../atoms/Button.jsx'
import { api } from '../../lib/api.js'

export default function ReviewComments({ review, currentUserId, onCountChange }) {
  const [items, setItems] = useState([])
  const [cursor, setCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [body, setBody] = useState('')
  const [reply, setReply] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [deleting, setDeleting] = useState(null)
  const input = useRef(null)
  const base = `/api/reviews/${review.id}/comments`
  useEffect(() => {
    const controller = new AbortController()
    api(base, { signal: controller.signal }).then((data) => { setItems(data.comments); setCursor(data.nextCursor); setLoading(false); setError('') })
      .catch((failure) => { if (!controller.signal.aborted) { setError(failure.message); setLoading(false) } })
    return () => controller.abort()
  }, [base, attempt])
  async function more() {
    setBusy(true); setError('')
    try {
      const data = await api(`${base}?after=${cursor}`)
      setItems((current) => [...current, ...data.comments.filter((item) => !current.some((entry) => entry.id === item.id))].sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : 1))
      setCursor(data.nextCursor)
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      const { comment } = await api(base, { method: 'POST', body: { body, parentId: reply?.id ?? null } })
      setItems((current) => [...current, comment])
      setBody(''); setReply(null)
      onCountChange((review.commentCount ?? 0) + 1)
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  async function remove(id) {
    setBusy(true); setError('')
    try {
      await api(`${base}/${id}`, { method: 'DELETE' })
      setItems((current) => current.map((item) => item.id === id ? { ...item, deleted: true, body: '' } : item))
      if (reply?.id === id) setReply(null)
      setDeleting(null)
      onCountChange(Math.max(0, (review.commentCount ?? 0) - 1))
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  return <section id="comments" aria-labelledby="comments-title" className="paper-card mt-6 p-5 sm:p-6">
    <h2 id="comments-title" className="font-serif text-2xl">Around this table <span className="font-mono text-sm text-muted">({review.commentCount ?? 0})</span></h2>
    <p className="mt-2 text-xs leading-6 text-muted">Ask about the dish, swap a recommendation, or leave a little appreciation.</p>
    {error && <p role="alert" className="mt-4 text-xs text-brand">{error} <button type="button" className="underline" onClick={() => setAttempt((value) => value + 1)}>Refresh conversation</button></p>}
    {loading ? <p role="status" className="mt-5 text-xs text-muted">Gathering the conversation…</p> : <>
      {!items.length && !error && <p className="my-6 text-sm text-muted">No comments yet. Pull up a chair.</p>}
      <ol className="mt-4 space-y-4">{items.map((item) => <li id={`comment-${item.id}`} key={item.id} className={`scroll-mt-6 border-b border-dashed border-line pb-4 ${item.parentId ? 'ml-3 border-l-2 pl-3 sm:ml-6' : ''}`}>
        {item.parentId && <p className="mb-1 text-[10px] text-muted">Replying to {item.replyToName || 'a diner'}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><Link to={`/profile/${item.author.id}`} className="text-xs font-semibold text-accent">{item.author.name}</Link><time dateTime={item.createdAt} className="text-[10px] text-muted">{new Date(item.createdAt).toLocaleString()}</time></div>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{item.deleted ? <i className="text-muted">Comment removed.</i> : item.body}</p>
        {!item.deleted && <div className="mt-2 flex gap-4 text-xs">
          <button type="button" disabled={busy} className="text-accent underline" onClick={() => { setReply(item); input.current?.focus() }}>Reply</button>
          {(item.author.id === currentUserId || review.author?.id === currentUserId) && <button type="button" disabled={busy} className="text-muted underline" onClick={() => setDeleting(item.id)}>Delete comment</button>}
        </div>}
        {deleting === item.id && <div className="mt-3 rounded border border-line bg-paper p-3 text-xs"><p>Remove this comment? Replies will remain.</p><div className="mt-3 flex gap-4"><button type="button" disabled={busy} className="text-brand underline" onClick={() => remove(item.id)}>Confirm removal</button><button type="button" disabled={busy} className="underline" onClick={() => setDeleting(null)}>Cancel</button></div></div>}
      </li>)}</ol>
      {cursor && <button type="button" disabled={busy} onClick={more} className="my-4 text-xs text-accent underline">Load more comments</button>}
      <form onSubmit={submit} className="mt-6">
        {reply && <p className="mb-3 text-xs text-accent">Replying to {reply.author.name} <button type="button" className="ml-3 underline" onClick={() => setReply(null)}>Cancel reply</button></p>}
        <label htmlFor="comment-body" className="text-xs">{reply ? 'Your reply' : 'Your comment'}</label>
        <textarea ref={input} id="comment-body" required maxLength={1000} rows={3} value={body} disabled={busy} onChange={(event) => setBody(event.target.value)} className="bg-notes mt-2 block w-full rounded-md p-3 text-sm" />
        <div className="mt-3 flex items-center justify-between gap-3"><span className="text-[10px] text-muted">{body.length}/1000</span><Button type="submit" size="sm" disabled={busy || !body.trim()}>{busy ? 'Saving…' : reply ? 'Post reply' : 'Post comment'}</Button></div>
      </form>
    </>}
  </section>
}
