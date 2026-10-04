const express = require('express')
const { text } = require('../validate')
const { perUserLimit } = require('../rateLimit')

const router = express.Router()

// The key stays here on the server. The browser only ever talks to /api/places.
const API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? ''
const REGION = (process.env.GOOGLE_PLACES_REGION ?? '').trim().toLowerCase()
const isConfigured = API_KEY !== '' && !API_KEY.startsWith('your_')

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete'

// Google tags each place with types. Keep only places to eat or drink: "food" covers most,
// and the rest catch cafes, bars and any "..._restaurant" (filipino_restaurant, fast_food_restaurant...).
const FOOD_TYPES = new Set(['food', 'restaurant', 'cafe', 'coffee_shop', 'bakery', 'bar', 'meal_takeaway', 'meal_delivery', 'food_court'])
function isPlaceToEat(prediction) {
  return (prediction.types ?? []).some((type) => FOOD_TYPES.has(type) || type.endsWith('_restaurant'))
}

// At most 30 searches a minute per user (typing is debounced, so real use is far lower)
const searchLimit = perUserLimit({
  limit: 30,
  windowMs: 60 * 1000,
  message: 'Too many searches. Wait a moment and try again.',
})

// GET /api/places/autocomplete?q=jollibee
// Returns up to five places to eat that match what the user typed: { places: [{ placeId, name, address }] }
router.get('/autocomplete', searchLimit, async (req, res) => {
  if (!isConfigured) {
    return res.status(503).json({ error: 'Google restaurant search is not set up yet.' })
  }
  const query = text(req.query.q, 'Search', { min: 2, max: 100 })

  let response
  try {
    response = await fetch(AUTOCOMPLETE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': API_KEY },
      body: JSON.stringify({
        input: query,
        languageCode: 'en',
        ...(REGION ? { includedRegionCodes: [REGION], regionCode: REGION } : {}),
      }),
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    return res.status(502).json({ error: 'Google search did not respond. Try again.' })
  }

  if (!response.ok) {
    // Google's own message goes to the server log only (it never contains the key)
    const detail = await response.text().catch(() => '')
    console.error(`Google Places error ${response.status}: ${detail.slice(0, 300)}`)
    return res.status(502).json({ error: 'Google search is unavailable right now.' })
  }

  const data = await response.json()
  const places = (data.suggestions ?? [])
    .map((suggestion) => suggestion.placePrediction)
    .filter((prediction) => prediction?.placeId && isPlaceToEat(prediction))
    .map((prediction) => ({
      placeId: prediction.placeId,
      name: prediction.structuredFormat?.mainText?.text ?? prediction.text?.text ?? '',
      address: prediction.structuredFormat?.secondaryText?.text ?? '',
    }))
    .filter((place) => place.name)

  res.json({ places })
})

module.exports = { router }
