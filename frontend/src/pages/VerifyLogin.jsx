import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import Button from '../components/atoms/Button.jsx'
import TextField from '../components/atoms/TextField.jsx'
import AuthCard, { FormError } from '../components/organisms/AuthCard.jsx'
import { authCall, authClient, authErrorMessage } from '../lib/auth.js'
import { api } from '../lib/api.js'

export default function VerifyLogin() {
  const { data: session, isPending } = authClient.useSession()
  if (isPending) return <AuthCard title="Finishing sign-in"><p role="status">Loading your session…</p></AuthCard>
  if (!session?.user) return <Navigate to="/login" replace />
  return <CodeForm key={session.session.id} email={session.user.email} />
}

function CodeForm({ email }) {
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from
  const destination = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/verify-') ? from : '/'
  const [code, setCode] = useState('')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [wait, setWait] = useState(0)
  const operation = useRef(false)

  useEffect(() => {
    let active = true
    api('/api/auth/email/status').then(async (status) => {
      if (!active) return
      if (status.verified) { navigate(destination, { replace: true }); return }
      setWait(status.retryAfter)
      if (!status.sent && !status.retryAfter) {
        const result = await api('/api/auth/email/send', { method: 'POST' })
        if (!active) return
        setWait(result.retryAfter)
        setNotice('Your code is on its way. Check your inbox and spam folder.')
      } else setNotice(status.sent ? 'Your code is on its way. Check your inbox and spam folder.' : 'Request a new code once the countdown finishes.')
      setReady(true)
    }).catch((err) => {
      if (!active) return
      setError(err.message)
      setWait(err.retryAfter ?? 0)
      setReady(true)
    })
    return () => { active = false }
  }, [destination, navigate])

  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait((seconds) => seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  async function sendCode() {
    if (operation.current || wait > 0) return
    operation.current = true
    setBusy(true); setError('')
    try {
      const result = await api('/api/auth/email/send', { method: 'POST' })
      setWait(result.retryAfter)
      setCode('')
      setNotice('A code is on its way. Check your inbox and spam folder. Use the newest code.')
    } catch (err) {
      setError(err.message)
      setWait(err.retryAfter ?? 0)
    } finally { operation.current = false; setBusy(false) }
  }

  async function verify(event) {
    event.preventDefault()
    if (operation.current) return
    const otp = code.replace(/\s/g, '')
    if (!/^\d{4,10}$/.test(otp)) { setError('Enter the code from your email (numbers only).'); return }
    operation.current = true
    setBusy(true); setError('')
    try {
      await api('/api/auth/email/verify', { method: 'POST', body: { otp } })
      navigate(destination, { replace: true })
    } catch (err) { setError(err.message) }
    finally { operation.current = false; setBusy(false) }
  }

  async function cancel() {
    if (operation.current) return
    operation.current = true; setBusy(true); setError('')
    // Neon revocation invalidates the receipt even if clearing its cookie fails.
    await api('/api/auth/email/logout', { method: 'POST' }).catch(() => {})
    const result = await authCall(() => authClient.signOut())
    if (result.error) { setError(authErrorMessage(result.error)); operation.current = false; setBusy(false) }
    else navigate('/login', { replace: true })
  }

  return <AuthCard title="Confirm your sign-in" subtitle={`Enter the email code for ${email}`}
    footer={<button type="button" onClick={cancel} disabled={busy} className="font-semibold text-accent underline disabled:opacity-50">Use a different account</button>}>
    <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted">Step 2 of 2 · Email code</p>
    <p role="status" className="mb-5 font-mono text-sm text-ink">{ready ? notice : 'Checking your sign-in…'}</p>
    <form onSubmit={verify} noValidate className="space-y-5">
      <TextField id="login-code" label="Code from your email" autoComplete="one-time-code" inputMode="numeric"
        maxLength={10} placeholder="123456" value={code} disabled={busy || !ready}
        onChange={(event) => setCode(event.target.value)} hint="Codes expire. If yours no longer works, request a new one." />
      <Button type="submit" className="w-full" disabled={busy || !ready}>{busy ? 'Please wait…' : 'Verify & log in'}</Button>
    </form>
    <FormError message={error} />
    <p className="mt-5 text-center font-mono text-sm">
      <button type="button" onClick={sendCode} disabled={busy || !ready || wait > 0}
        className="font-semibold text-accent underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline">
        {wait > 0 ? `Send a new code in ${wait}s` : 'Send email code'}
      </button>
    </p>
  </AuthCard>
}
