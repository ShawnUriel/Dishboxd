// Server-side checks for everything a user sends. The browser checks too, but anyone
// can call the API directly, so these are the checks that actually protect the data.

class ValidationError extends Error {
  constructor(message) {
    super(message)
    this.status = 400
  }
}

function text(value, field, { min = 0, max }) {
  if (typeof value !== 'string') throw new ValidationError(`${field} must be text.`)
  const clean = value.trim()
  if (clean.length < min) throw new ValidationError(min === 1 ? `${field} is required.` : `${field} is too short.`)
  if (clean.length > max) throw new ValidationError(`${field} must be ${max} characters or fewer.`)
  return clean
}

function optionalText(value, field, options) {
  if (value === undefined || value === null) return ''
  return text(value, field, options)
}

function integer(value, field, { min, max }) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ValidationError(`${field} must be a whole number from ${min} to ${max}.`)
  }
  return value
}

// An item's score out of 10. It may go past 10, up to 12, for a dish that was that good.
const MAX_SCORE = 12

function score(value, field) {
  if (value === undefined || value === null || value === '') return null
  return integer(value, field, { min: 0, max: MAX_SCORE })
}

function number(value, field, { min, max }) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new ValidationError(`${field} must be a number from ${min} to ${max}.`)
  }
  return value
}

function money(value, field) {
  const amount = Number(value)
  if (value === '' || value === null || !Number.isFinite(amount) || amount < 0 || amount > 10000) {
    throw new ValidationError(`${field} must be a price from 0 to 10,000.`)
  }
  return Math.round(amount * 100) / 100
}

// "YYYY-MM-DD" that is a real calendar date and not more than a day in the future
function visitDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError('Date must look like 2026-09-27.')
  }
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ValidationError('Date is not a real calendar date.')
  }
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  if (value > tomorrow) throw new ValidationError('Date cannot be in the future.')
  return value
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

// A username someone picks: 3 to 10 characters of letters, numbers and a few special
// characters, with at least one letter or number. Saved in lowercase, so "Bea" and "bea" are one name.
// The frontend shows the same rules (frontend/src/lib/username.js).
const USERNAME_SPECIALS = '_.-!?*#$&'

function username(value) {
  if (typeof value !== 'string') throw new ValidationError('Username must be text.')
  const clean = value.trim().toLowerCase()
  if (clean.length < 3) throw new ValidationError('Username needs at least 3 characters.')
  if (clean.length > 10) throw new ValidationError('Username can be at most 10 characters.')
  if (!/^[a-z0-9_.!?*#$&-]+$/.test(clean))
    throw new ValidationError(`Username can use letters, numbers and ${USERNAME_SPECIALS.split('').join(' ')} only, with no spaces.`)
  if (!/[a-z0-9]/.test(clean)) throw new ValidationError('Username needs at least one letter or number.')
  return clean
}

module.exports = { ValidationError, MAX_SCORE, text, optionalText, integer, score, number, money, visitDate, isUuid, username }
