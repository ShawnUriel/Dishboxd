import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { SettingsContext } from './settingsContext.js'

const defaults = { theme: 'system', reduceMotion: false, defaultReviewPublic: false, isPrivate: false }
export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(defaults)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    api('/api/settings', { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) { setSettings(data.settings); setReady(true); setError('') }
    }).catch(failure => { if (!controller.signal.aborted) setError(failure.message) })
    return () => controller.abort()
  }, [attempt])
  useEffect(() => {
    if (!ready) return
    const system = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      document.documentElement.dataset.theme = settings.theme === 'system' ? (system.matches ? 'dark' : 'light') : settings.theme
      document.documentElement.dataset.reduceMotion = String(settings.reduceMotion)
      try { localStorage.setItem('dishboxd-appearance', JSON.stringify({ theme: settings.theme, reduceMotion: settings.reduceMotion })) } catch { /* Storage can be disabled; server preferences still work. */ }
    }
    apply()
    system.addEventListener('change', apply)
    return () => system.removeEventListener('change', apply)
  }, [settings.theme, settings.reduceMotion, ready])
  async function save(changes) {
    if (busy || !ready) return false
    setBusy(true); setError('')
    try {
      const data = await api('/api/settings', { method: 'PATCH', body: changes })
      setSettings(data.settings)
      return true
    } catch (failure) { setError(failure.message); return false }
    finally { setBusy(false) }
  }
  return <SettingsContext.Provider value={{ settings, ready, busy, error, save, retry: () => setAttempt(value => value + 1) }}>{children}</SettingsContext.Provider>
}
