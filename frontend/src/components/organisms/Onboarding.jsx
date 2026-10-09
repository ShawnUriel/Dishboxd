import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import UsernameStep from './UsernameStep.jsx'
import WelcomeTour from './WelcomeTour.jsx'
import './onboarding.css'

// New diners first pick a username, then get a short tour of Home. The server remembers both,
// so each shows once per account rather than once per device.
export default function Onboarding() {
  const [state, setState] = useState(null)
  useEffect(() => {
    const controller = new AbortController()
    api('/api/profiles/me', { signal: controller.signal })
      .then((data) => setState(data.onboarding))
      .catch(() => {}) // The journal still works without it; onboarding tries again next visit
    return () => controller.abort()
  }, [])
  const finishTour = useCallback(() => {
    setState((current) => ({ ...current, needsTour: false }))
    api('/api/profiles/me/tour', { method: 'PUT' }).catch(() => {}) // If saving fails, the tour shows again next visit
  }, [])

  if (state?.needsUsername) return <UsernameStep onSaved={(data) => setState(data.onboarding)} />
  if (state?.needsTour) return <WelcomeTour onDone={finishTour} />
  return null
}
