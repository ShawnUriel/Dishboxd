import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Button from '../atoms/Button.jsx'
import { api } from '../../lib/api.js'
import UsernameStep from './UsernameStep.jsx'
import WelcomeTour from './WelcomeTour.jsx'
import './onboarding.css'

// New diners first pick a username, then get a short tour of Home. The server remembers both,
// so each shows once per account rather than once per device.
export default function Onboarding({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [state, setState] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const replay = new URLSearchParams(location.search).get('tour') === '1'
  useEffect(() => {
    const controller = new AbortController()
    api('/api/profiles/me', { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setState(data.onboarding)
          setError('')
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message)
      })
    return () => controller.abort()
  }, [attempt])
  const finishTour = useCallback(async () => {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const data = await api('/api/profiles/me/tour', { method: 'PUT' })
      setState(data.onboarding)
      if (replay) navigate('/', { replace: true })
    } catch (failure) {
      setError(failure.message)
    } finally {
      setSaving(false)
    }
  }, [saving, replay, navigate])

  if (!state) return <div className="bg-lined grid min-h-screen place-items-center p-6"><div className="paper-card max-w-md p-6">
    {error ? <><p role="alert" className="text-sm text-brand">Could not load account setup: {error}</p><Button className="mt-4" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Retry</Button></> : <p role="status" className="text-sm text-muted">Getting your account ready…</p>}
  </div></div>
  if (state.needsUsername) return <div className="bg-lined min-h-screen"><UsernameStep onSaved={(data) => setState(data.onboarding)} /></div>
  return <>{children}{(state.needsTour || replay) && <WelcomeTour onDone={finishTour} busy={saving} error={error} />}</>
}
