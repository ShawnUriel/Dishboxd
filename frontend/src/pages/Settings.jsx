import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../components/atoms/Button.jsx'
import { authClient, authCall } from '../lib/auth.js'
import { api } from '../lib/api.js'
import { useSettings } from '../state/useSettings.js'
import './Settings.css'

function Toggle({ label, description, checked, onChange, disabled }) {
  return <label className="settings-row"><span><span className="settings-label">{label}</span><span className="settings-description">{description}</span></span><input type="checkbox" role="switch" aria-label={label} checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} className="settings-toggle" /></label>
}

export default function Settings() {
  const { settings, ready, busy, error, save, retry } = useSettings()
  const { data: session } = authClient.useSession()
  const navigate = useNavigate()
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [working, setWorking] = useState(false)
  async function change(values) {
    setNotice(''); setActionError('')
    if (await save(values)) setNotice(values.isPrivate === true ? 'Private account enabled. Shared reviews are now visible only to friends.' : values.isPrivate === false ? 'Public account enabled. Shared reviews are visible to all signed-in diners.' : 'Your settings are saved.')
  }
  async function exportJournal() {
    setWorking(true); setActionError(''); setNotice('')
    try {
      const [profile, restaurants, visits, boxes, bookmarks] = await Promise.all(['/api/profiles/me', '/api/restaurants', '/api/visits', '/api/boxes', '/api/bookmarks'].map(url => api(url)))
      const blob = new Blob([JSON.stringify({ format: 'dishboxd-journal', version: 1, exportedAt: new Date().toISOString(), profile: profile.profile, restaurants: restaurants.restaurants, reviews: visits.visits, collections: boxes.boxes, bookmarks: bookmarks.bookmarks, settings }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a'); link.href = url; link.download = `dishboxd-journal-${new Date().toISOString().slice(0, 10)}.json`; document.body.append(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice('Your journal export is ready. Photos and sticker image files are not included.')
    } catch (failure) { setActionError(failure.message) }
    finally { setWorking(false) }
  }
  async function signOut() {
    setWorking(true); setActionError('')
    try { const result = await authCall(() => authClient.signOut()); if (result.error) throw new Error('Could not sign out. Please try again.'); navigate('/login', { replace: true }) }
    catch (failure) { setActionError(failure.message) }
    finally { setWorking(false) }
  }
  return <div className="settings-page page-enter mx-auto max-w-3xl">
    <header className="settings-header"><p className="settings-eyebrow">The little details</p><h1 className="font-serif text-4xl font-semibold">Make yourself at home.</h1><p className="mt-3 text-sm leading-7 text-muted">Your journal, your comfort, your circle.</p></header>
    <nav className="settings-jump" aria-label="Settings sections">{[['appearance', 'Appearance'], ['privacy', 'Privacy'], ['account', 'Account'], ['notifications', 'Notifications'], ['data', 'Your data']].map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}</nav>
    {(error || actionError) && <p role="alert" className="settings-feedback text-brand">{error || actionError} {!ready && <button type="button" onClick={retry} className="ml-3 underline">Retry loading settings</button>}</p>}
    <p role="status" aria-live="polite" className="settings-status">{busy ? 'Saving your settings…' : notice || (!ready && !error ? 'Loading your settings…' : 'Changes save automatically.')}</p>
    <section id="appearance" className="paper-card settings-section"><p className="settings-eyebrow">01 / Set the mood</p><h2>Appearance</h2><p className="settings-description">A bright page, an evening journal, or whatever your device prefers.</p>
      <fieldset disabled={!ready || busy} className="mt-5"><legend className="sr-only">Color theme</legend><div className="theme-options">{[['light', 'Light', '☀'], ['dark', 'Dark', '☾'], ['system', 'System', '◐']].map(([value, label, symbol]) => <label className={`theme-option theme-${value} ${settings.theme === value ? 'is-selected' : ''}`} key={value}><input type="radio" name="theme" value={value} checked={settings.theme === value} onChange={() => change({ theme: value })} /><span className="theme-swatch" aria-hidden="true"><span>{symbol}</span><i /><i /></span><span>{label}</span>{settings.theme === value && <span className="theme-check" aria-hidden="true">✓</span>}</label>)}</div></fieldset>
      <Toggle label="Reduce motion" description="Use quieter transitions and fewer animations. Your device’s reduced-motion preference is always respected." checked={settings.reduceMotion} disabled={!ready || busy} onChange={value => change({ reduceMotion: value })} />
    </section>
    <section id="privacy" className="paper-card settings-section"><p className="settings-eyebrow">02 / Choose your circle</p><h2>Privacy & sharing</h2>
      <Toggle label="Private account" description="Only friends—people you follow who follow you back—can see your shared reviews and their photos. Applies to existing and future reviews." checked={settings.isPrivate} disabled={!ready || busy} onChange={value => change({ isPrivate: value })} />
      <div className="settings-note">{settings.isPrivate ? 'Friends only. Following you alone does not grant access. Your name, username, bio, and avatar remain discoverable so people can find you.' : 'Public account. Shared reviews can appear in Discover and other diners’ feeds.'} Reviews marked “Only me” stay personal; an invited co-author can access them while your account privacy allows it. Changing account privacy does not change individual sharing choices.</div>
      <Toggle label="Share new reviews by default" description={settings.isPrivate ? 'New reviews start shared with friends. You can change this on every review.' : 'New reviews start shared with signed-in diners. You can change this on every review.'} checked={settings.defaultReviewPublic} disabled={!ready || busy} onChange={value => change({ defaultReviewPublic: value })} />
      <Link to="/friends" className="settings-link">Manage your friends →</Link>
    </section>
    <section id="account" className="paper-card settings-section"><p className="settings-eyebrow">03 / Your place at the table</p><h2>Account & profile</h2><dl className="settings-account"><div><dt>Signed in as</dt><dd>{session?.user.name || 'Food lover'}</dd></div><div><dt>Email</dt><dd>{session?.user.email || 'Managed by your sign-in provider'}</dd></div></dl><Link to="/profile" className="settings-link">Edit your name, username, bio & profile photo →</Link><p className="settings-description mt-3">Your login email is managed by your sign-in provider.</p></section>
    <section id="notifications" className="paper-card settings-section"><p className="settings-eyebrow">04 / A little less noise</p><h2>Notifications</h2><p className="settings-description">Choose alerts for followers, reposts, comments, and replies, plus your optional email digest schedule.</p><Link to="/settings/notifications" className="settings-link">Manage notification preferences →</Link></section>
    <section id="data" className="paper-card settings-section"><p className="settings-eyebrow">05 / Keep your memories</p><h2>Your data & session</h2><p className="settings-description">Download your profile, reviews, restaurants, collections, bookmarks, and settings as a JSON file. Photos and sticker image files are not included.</p><div className="mt-5 flex flex-wrap gap-3"><Button variant="secondary" disabled={working || !ready} onClick={exportJournal}>Download my journal</Button><Button variant="secondary" disabled={working} onClick={signOut}>Sign out</Button></div></section>
  </div>
}
