import { useState } from 'react'
import Button from '../atoms/Button.jsx'
import TextField from '../atoms/TextField.jsx'
import { authClient, authCall, authErrorMessage, PASSWORD_MIN, PASSWORD_MAX } from '../../lib/auth.js'

export default function PasswordSettings() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setError(''); setNotice('')
    if (newPassword !== confirmation) { setError('The new passwords do not match.'); return }
    if (currentPassword === newPassword) { setError('Choose a different new password.'); return }
    setBusy(true)
    const result = await authCall(() => authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true }))
    setBusy(false)
    if (result.error) { setError(authErrorMessage(result.error)); return }
    setCurrentPassword(''); setNewPassword(''); setConfirmation('')
    setNotice('Your password has been updated. Other sessions have been signed out.')
  }
  return <details className="mt-6 border-t border-dashed border-line pt-5"><summary className="text-sm text-accent">Change password</summary><p className="settings-description mt-3">For email and password accounts. If you sign in with Google, manage your password in your Google account. Changing your password signs out your other sessions.</p><form onSubmit={submit} className="mt-5 space-y-5"><fieldset disabled={busy} className="space-y-5">
    <TextField id="current-password" label="Current password" type="password" autoComplete="current-password" required maxLength={PASSWORD_MAX} value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} />
    <TextField id="new-password" label="New password" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} value={newPassword} onChange={event => setNewPassword(event.target.value)} />
    <TextField id="confirm-password" label="Confirm new password" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} value={confirmation} onChange={event => setConfirmation(event.target.value)} />
    <p className="settings-description">Use {PASSWORD_MIN}–{PASSWORD_MAX} characters.</p><Button type="submit" variant="secondary">{busy ? 'Updating password…' : 'Update password'}</Button>
  </fieldset>{error && <p role="alert" className="text-sm text-brand">{error}</p>}{notice && <p role="status" className="text-sm text-accent">{notice}</p>}</form></details>
}
