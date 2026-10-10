import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Button from '../components/atoms/Button.jsx'
import TextField from '../components/atoms/TextField.jsx'
import GoogleButton from '../components/molecules/GoogleButton.jsx'
import AuthCard, { FormError, OrDivider } from '../components/organisms/AuthCard.jsx'
import { authCall, authClient, authErrorMessage, isUnverifiedEmail, looksLikeEmail } from '../lib/auth.js'

// The primary login is followed by a server-enforced email-code check.
export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(
    params.get('error') === 'google' ? 'Google sign-in did not finish. Please try again.' : '',
  )
  const notice = location.state?.notice ?? ''
  const goTo = location.state?.from ?? '/'

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    const cleanEmail = email.trim()
    if (!looksLikeEmail(cleanEmail)) return setError('Enter a valid email address.')
    if (!password) return setError('Enter your password.')

    setBusy(true)
    const { error: signInError } = await authCall(() =>
      authClient.signIn.email({ email: cleanEmail, password }),
    )
    if (!signInError) {
      navigate('/verify-login', { replace: true, state: { from: goTo } })
      return
    }

    // The account exists but its email was never confirmed: send a fresh code and ask for it
    if (isUnverifiedEmail(signInError)) {
      await authCall(() =>
        authClient.emailOtp.sendVerificationOtp({ email: cleanEmail, type: 'email-verification' }),
      )
      navigate(`/verify-email?email=${encodeURIComponent(cleanEmail)}`, { state: { resent: true } })
      return
    }

    setError(authErrorMessage(signInError))
    setBusy(false)
  }

  return (
    <AuthCard
      title="Log in"
      subtitle="Enter your password, then confirm the code sent to your email."
      footer={
        <>
          New to Dishboxd?{' '}
          <Link to="/signup" className="font-semibold text-accent underline hover:text-accent-dark">
            Sign up
          </Link>
        </>
      }
    >
      {notice && (
        <p role="status" className="mb-4 font-mono text-sm text-ink">
          {notice}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="login-email"
          label="Email"
          type="email"
          autoComplete="email"
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <TextField
          id="login-password"
          label="Password"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Checking password…' : 'Continue to email code'}
        </Button>
      </form>

      <FormError message={error} />
      <OrDivider />
      <GoogleButton onError={setError} />
    </AuthCard>
  )
}
