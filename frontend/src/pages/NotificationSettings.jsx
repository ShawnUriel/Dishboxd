import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/atoms/Button.jsx'
import { api } from '../lib/api.js'

export default function NotificationSettings() {
  const [preferences, setPreferences] = useState(null)
  const [emailReady, setEmailReady] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    api('/api/notifications/preferences', { signal: controller.signal }).then((data) => { setPreferences(data.preferences); setEmailReady(data.emailReady); setError('') })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message) })
    return () => controller.abort()
  }, [attempt])
  async function save(event) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      const data = await api('/api/notifications/preferences', { method: 'PATCH', body: preferences })
      setPreferences(data.preferences)
      setNotice('Your notification preferences are saved.')
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  return <div className="page-enter mx-auto max-w-2xl">
    <Link to="/profile" className="text-xs text-accent underline">← Your profile</Link>
    <h1 className="mt-6 font-serif text-3xl font-semibold">A little less noise.</h1>
    <p className="mt-3 text-sm leading-7 text-muted">Choose what reaches your notification inbox.</p>
    {error && <p role="alert" className="mt-5 text-sm text-brand">{error} {!preferences && <button type="button" className="underline" onClick={() => setAttempt((value) => value + 1)}>Retry</button>}</p>}
    {!preferences ? !error && <p role="status" className="mt-6 text-sm text-muted">Loading your preferences…</p> : <form onSubmit={save} className="paper-card mt-6 p-5 sm:p-8">
      <fieldset disabled={busy}>
        <legend className="font-serif text-2xl">In-app notifications</legend>
        <p className="mt-2 text-xs leading-6 text-muted">Changes apply to new activity. Previous notifications stay in your inbox.</p>
        <div className="my-5 divide-y divide-dashed divide-line">{[
          ['follows', 'New followers', 'When another diner follows your journal.'],
          ['reposts', 'Review reposts', 'When someone shares your review with their followers.'],
          ['comments', 'Comments on your reviews', 'When a diner joins the conversation on your ticket.'],
          ['replies', 'Replies to your comments', 'When someone responds directly to you.'],
        ].map(([key, label, description]) => <label key={key} className="flex cursor-pointer items-center justify-between gap-5 py-4">
          <span><span className="block text-sm">{label}</span><span className="mt-1 block text-xs leading-6 text-muted">{description}</span></span>
          <input type="checkbox" className="size-5 shrink-0 accent-brand" checked={preferences[key]} onChange={(event) => { setPreferences((current) => ({ ...current, [key]: event.target.checked })); setNotice('') }} />
        </label>)}</div>
        <label htmlFor="digest-frequency" className="font-serif text-2xl">Email digest</label>
        <p id="digest-hint" className="mt-2 text-xs leading-6 text-muted">An optional summary of unread activity, sent to your verified account email. Off by default. Turn it off here at any time.</p>
        {!emailReady && <p className="mt-3 rounded-md border border-line bg-paper p-3 text-xs leading-6 text-muted">Email delivery is not configured yet. You can save your preferred schedule; no emails will be sent until delivery is enabled.</p>}
        <select id="digest-frequency" aria-describedby="digest-hint" className="mt-4 w-full rounded-md border border-line bg-paper p-3 text-sm" value={preferences.digestFrequency} onChange={(event) => { setPreferences((current) => ({ ...current, digestFrequency: event.target.value })); setNotice('') }}>
          <option value="off">Off — no email digests</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
        </select>
        <Button type="submit" className="mt-6">{busy ? 'Saving…' : 'Save preferences'}</Button>
      </fieldset>
      {notice && <p role="status" className="mt-4 text-sm text-accent">{notice}</p>}
    </form>}
  </div>
}
