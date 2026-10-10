// The username rule, shown while people type. The API checks the same rule
// (backend/validate.js), so change both together.
export const USERNAME_MIN = 3
export const USERNAME_MAX = 10
export const USERNAME_SPECIALS = ['.', '_', '-']

const allowed = /^[a-z0-9_.-]+$/

// Usernames are saved in lowercase, so the field shows them that way as you type
export const normalizeUsername = (value) => value.toLowerCase()

// One entry per rule, for the checklist under the field
export function usernameChecks(value) {
  return [
    {
      id: 'length',
      label: `${USERNAME_MIN} to ${USERNAME_MAX} characters`,
      ok: value.length >= USERNAME_MIN && value.length <= USERNAME_MAX,
    },
    { id: 'characters', label: 'Letters, numbers and the special characters below only. No spaces.', ok: allowed.test(value) },
    { id: 'letter', label: 'At least one letter or number', ok: /[a-z0-9]/.test(value) },
  ]
}

export const isValidUsername = (value) => usernameChecks(value).every((check) => check.ok)
