// Small helpers for showing numbers and dates the same way on every screen.

// Prices are in Philippine pesos: ₱1,250.00
const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

export function formatMoney(amount) {
  return peso.format(Number(amount || 0))
}

export function formatRating(rating, decimals = 1) {
  return Number(rating || 0).toFixed(decimals)
}

// Dates are stored as "YYYY-MM-DD". Build the Date from its parts so it
// is not shifted by the time zone (new Date("2026-09-21") would be UTC).
function toLocalDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatDate(isoDate) {
  return toLocalDate(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// A moment something happened, in the viewer's own time zone: "Oct 9, 2026, 3:42 PM"
const dateTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

export function formatDateTime(timestamp) {
  return dateTime.format(new Date(timestamp))
}

export function formatMonth(date = new Date()) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function todayIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

// R-014 on the profile, R14 on the small search badge
export function restaurantCode(number, short = false) {
  return short ? `R${String(number).padStart(2, '0')}` : `R-${String(number).padStart(3, '0')}`
}
