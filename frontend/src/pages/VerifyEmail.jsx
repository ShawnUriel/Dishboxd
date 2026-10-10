import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Button from '../components/atoms/Button.jsx'
import TextField from '../components/atoms/TextField.jsx'
import AuthCard, { FormError } from '../components/organisms/AuthCard.jsx'
import { authCall, authClient, authErrorMessage, looksLikeEmail } from '../lib/auth.js'
import { api } from '../lib/api.js'

const RESEND_WAIT_SECONDS = 30

// "Check your email": the user types the code Neon Auth emailed them.
// A correct code confirms the address and signs them in.
export default function VerifyEmail() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const email = params.get('email') ?? ''
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(
    location.state?.resent ? 'Your email is not confirmed yet, so we sent you a new code.' : '',
  )
  const [wait, setWait] = useState(0)

  // Count down before another code can be requested
  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait((seconds) => seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  if (!looksLikeEmail(email)) return <Navigate to="/signup" replace />

  async function handleVerify(event) {
    event.preventDefault()
    setError('')
    const otp = code.replace(/\s/g, '')
    if (!/^\d{4,10}$/.test(otp)) return setError('Enter the code from the email (numbers only).')

    setBusy(true)
    // Check this same signup code on the API before Neon consumes it, then bind
    // its short-lived receipt to the new session when the journal opens.
    try {
      await api('/api/auth/email/signup-receipt', { method: 'POST', body: { email, otp }, anonymous: true })
    } catch (err) {
      if (err.status === 409) {
        navigate('/login', { replace: true, state: { notice: 'Your email is already confirmed. Log in to continue.' } })
        return
      }
      setError(err.message)
      setBusy(false)
      return
    }
    const { error: verifyError } = await authCall(() => authClient.emailOtp.verifyEmail({ email, otp }))
    if (verifyError) {
      setError(authErrorMessage(verifyError))
      setBusy(false)
      return
    }

    // Neon Auth signs the user in after a correct code. If the session is not there yet, log in by hand.
    const { data: session } = await authCall(() => authClient.getSession())
    if (session?.user) navigate('/', { replace: true })
    else navigate('/login', { replace: true, state: { notice: 'Email confirmed. Log in to continue.' } })
  }

  async function handleResend() {
    setError('')
    setNotice('')
    setWait(RESEND_WAIT_SECONDS)
    const { error: sendError } = await authCall(() =>
      authClient.emailOtp.sendVerificationOtp({ email, type: 'email-verification' }),
    )
    if (sendError) setError(authErrorMessage(sendError))
    else setNotice('A new code is on its way. Check your inbox and spam folder.')
  }

  return (
    <AuthCard
      title="Check your email"
      subtitle={`We sent a code to ${email}`}
      footer={
        <>
          Wrong email?{' '}
          <Link to="/signup" className="font-semibold text-accent underline hover:text-accent-dark">
            Sign up again
          </Link>
        </>
      }
    >
      {notice && (
        <p role="status" className="mb-4 font-mono text-sm text-ink">
          {notice}
        </p>
      )}

      <form onSubmit={handleVerify} noValidate className="space-y-5">
        <TextField
          id="verify-code"
          label="Code from the email"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={10}
          placeholder="123456"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Checking…' : 'Confirm email'}
        </Button>
      </form>

      <FormError message={error} />

      <p className="mt-5 text-center font-mono text-sm text-muted">
        No email?{' '}
        <button
          type="button"
          onClick={handleResend}
          disabled={wait > 0}
          className="font-semibold text-accent underline hover:text-accent-dark disabled:cursor-not-allowed disabled:no-underline disabled:text-muted"
        >
          {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
        </button>
      </p>
    </AuthCard>
  )
}
