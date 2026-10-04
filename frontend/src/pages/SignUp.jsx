import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../components/atoms/Button.jsx'
import TextField from '../components/atoms/TextField.jsx'
import GoogleButton from '../components/molecules/GoogleButton.jsx'
import AuthCard, { FormError, OrDivider } from '../components/organisms/AuthCard.jsx'
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  authCall,
  authClient,
  authErrorMessage,
  looksLikeEmail,
} from '../lib/auth.js'

// "Sign up": name, email and password. Neon Auth then emails a code, and the account
// cannot be used until that code is entered on the next page. Google is the other way in.
export default function SignUp() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    const cleanName = name.trim()
    const cleanEmail = email.trim()
    if (!cleanName) return setError('Enter your name.')
    if (!looksLikeEmail(cleanEmail)) return setError('Enter a valid email address.')
    if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
      return setError(`Use a password between ${PASSWORD_MIN} and ${PASSWORD_MAX} characters.`)
    }

    setBusy(true)
    const { error: signUpError } = await authCall(() =>
      authClient.signUp.email({ name: cleanName, email: cleanEmail, password }),
    )
    if (signUpError) {
      setError(authErrorMessage(signUpError))
      setBusy(false)
      return
    }
    navigate(`/verify-email?email=${encodeURIComponent(cleanEmail)}`)
  }

  return (
    <AuthCard
      title="Sign up"
      subtitle="Start your food journal"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-accent underline hover:text-accent-dark">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="signup-name"
          label="Name"
          autoComplete="name"
          maxLength={60}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          id="signup-email"
          label="Email"
          type="email"
          autoComplete="email"
          maxLength={254}
          hint="We will email you a code to confirm it is yours."
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <TextField
          id="signup-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          maxLength={PASSWORD_MAX}
          hint={`At least ${PASSWORD_MIN} characters.`}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <FormError message={error} />
      <OrDivider />
      <GoogleButton onError={setError} />
    </AuthCard>
  )
}
