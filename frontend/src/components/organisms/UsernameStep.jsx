import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import Button from '../atoms/Button.jsx'
import PencilArrow from '../atoms/PencilArrow.jsx'
import UsernameField from '../molecules/UsernameField.jsx'
import { api } from '../../lib/api.js'
import { authCall, authClient } from '../../lib/auth.js'
import { isValidUsername } from '../../lib/username.js'

// The first thing a new account sees: pick the username other diners will know you by.
// It cannot be dismissed (Escape does nothing); logging out is the only other way out.
export default function UsernameStep({ onSaved }) {
  const navigate = useNavigate()
  const dialog = useRef(null)
  const field = useRef(null)
  const [handle, setHandle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const element = dialog.current
    if (!element.open) element.showModal()
    field.current?.focus()
    return () => element.close()
  }, [])

  async function save(event) {
    event.preventDefault()
    if (!isValidUsername(handle)) {
      setError('This username does not follow every rule yet. Each rule gets a tick once it is met.')
      field.current?.focus()
      return
    }
    setBusy(true)
    setError('')
    try {
      onSaved(await api('/api/profiles/me/username', { method: 'PUT', body: { handle } }))
    } catch (failure) {
      setError(failure.message)
      setBusy(false)
      field.current?.focus()
    }
  }
  async function logOut() {
    const result = await authCall(() => authClient.signOut())
    if (result.error) return setError('Could not log out. Try again.')
    navigate('/login', { replace: true })
  }

  return createPortal(
    <dialog
      ref={dialog}
      className="onboarding-dialog"
      aria-labelledby="username-title"
      aria-describedby="username-intro"
      onCancel={(event) => event.preventDefault()}
    >
      <form onSubmit={save} noValidate>
        <header className="border-b border-dashed border-line px-6 pt-6 pb-5 sm:px-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brand">Welcome to Dishboxd</p>
          <h1 id="username-title" className="mt-2 font-serif text-3xl font-bold tracking-tight">
            Pick your username
          </h1>
          <p id="username-intro" className="mt-2 font-mono text-sm leading-6 text-muted">
            Other diners see it as <span className="text-ink">@username</span> on your reviews and profile card,
            and use it to find you.
          </p>
        </header>
        <div className="relative px-6 pt-6 pb-2 sm:px-8">
          <div className="onboarding-scribble" aria-hidden="true">
            <span>that&rsquo;s you!</span>
            <svg viewBox="0 0 96 52" width="96" height="52">
              <PencilArrow from={{ x: 74, y: 8 }} to={{ x: 14, y: 44 }} bow={0.3} />
            </svg>
          </div>
          <UsernameField
            id="onboarding-username"
            ref={field}
            value={handle}
            onChange={(value) => {
              setHandle(value)
              if (error) setError('')
            }}
            placeholder="bea.eats"
            invalid={Boolean(error)}
            required
          />
          <p className="mt-5 font-mono text-sm text-muted">
            You will appear as{' '}
            <span className="break-all font-semibold text-ink">@{handle || 'username'}</span>
          </p>
          {error && (
            <p role="alert" className="mt-3 font-mono text-sm text-brand">
              {error}
            </p>
          )}
        </div>
        <footer className="px-6 pt-4 pb-6 sm:px-8">
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Saving…' : 'Save username'}
          </Button>
          <p className="mt-4 text-center font-mono text-xs text-muted">
            You can change it later on your profile.{' '}
            <button type="button" onClick={logOut} className="text-accent underline underline-offset-4">
              Log out
            </button>
          </p>
        </footer>
      </form>
    </dialog>,
    document.body,
  )
}
