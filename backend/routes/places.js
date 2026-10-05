const express = require('express')
const { text } = require('../validate')
const { perUserLimit } = require('../rateLimit')

const router = express.Router()

// The key stays here on the server. The browser only ever talks to /api/places.
const API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? ''
const REGION = (process.env.GOOGLE_PLACES_REGION ?? '').trim().toLowerCase()
const isConfigured = API_KEY !== '' && !API_KEY.startsWith('your_')

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete'
const PLACE_ID = /^[A-Za-z0-9_-]{10,512}$/
const PHOTO_RESOURCE = /^[A-Za-z0-9_-]{1,4096}$/
const PHOTO_ERROR = 'Restaurant photos are unavailable right now. Try again later.'

// Image URLs come from Google's media response, never from a client-supplied URL.
function safeGoogleUrl(value, kind = 'image') {
  if (typeof value !== 'string' || value.length > 8192) return null
  try {
    const url = new URL(value.startsWith('//') ? `https:${value}` : value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
    if (API_KEY && decodeURIComponent(url.href).includes(API_KEY)) return null
    if (url.searchParams.has('key') || url.searchParams.has('api_key')) return null
    if (kind !== 'image') {
      if (!['google.com', 'www.google.com', 'maps.google.com'].includes(url.hostname)) return null
      if (kind === 'author') {
        if (!/^\/maps\/contrib\/[A-Za-z0-9_-]+(?:\/(?:reviews|photos))?\/?$/.test(url.pathname)) return null
        // Contributor links need neither query parameters nor fragments.
        url.search = ''
        url.hash = ''
      } else {
        if (!/^\/maps(?:\/|$)/.test(url.pathname)) return null
        if (['url', 'continue', 'redirect', 'redirect_uri'].some((key) => url.searchParams.has(key))) return null
      }
    } else {
      if (!['googleusercontent.com', 'ggpht.com'].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) return null
    }
    return url.href
  } catch {
    return null
  }
}

async function googlePhotoJson(url, fieldMask) {
  const response = await fetch(url, {
    headers: { 'X-Goog-Api-Key': API_KEY, ...(fieldMask ? { 'X-Goog-FieldMask': fieldMask } : {}) },
    signal: AbortSignal.timeout(4000),
    redirect: 'error',
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('Photo lookup failed')
  return response.json()
}

// Without a location, Google favours places near whoever sends the request, which is this
// server: fine on my computer, but a data centre once deployed. So searches lean toward
// Angeles City. A small circle pulls harder: in testing, 5 km gave Angeles branches first,
// while 50 km (Google's maximum) gave Metro Manila ones. It is a bias, not a limit, so a
// place farther away still shows up when its name matches.
const SEARCH_AREA = { circle: { center: { latitude: 15.145, longitude: 120.5887 }, radius: 5000 } }

// Google tags each place with types. Keep only places to eat or drink: "food" covers most,
// and the rest catch cafes, bars and any "..._restaurant" (filipino_restaurant, fast_food_restaurant...).
const FOOD_TYPES = new Set(['food', 'restaurant', 'cafe', 'coffee_shop', 'bakery', 'bar', 'meal_takeaway', 'meal_delivery', 'food_court'])
function isPlaceToEat(prediction) {
  return (prediction.types ?? []).some((type) => FOOD_TYPES.has(type) || type.endsWith('_restaurant'))
}

// A starting category for the ticket from Google's types, in Google's order (most specific first).
// Cuisines come from "<cuisine>_restaurant"; the diner can always change it.
const CATEGORY_NAMES = {
  cafe: 'Cafe',
  coffee_shop: 'Coffee shop',
  tea_house: 'Tea house',
  bakery: 'Bakery',
  bar: 'Bar',
  pub: 'Bar',
  wine_bar: 'Wine bar',
  ice_cream_shop: 'Ice cream',
  dessert_shop: 'Dessert',
  dessert_restaurant: 'Dessert',
  donut_shop: 'Donuts',
  juice_shop: 'Juice bar',
  sandwich_shop: 'Sandwiches',
  food_court: 'Food court',
  fast_food_restaurant: 'Fast food',
  hamburger_restaurant: 'Burgers',
  pizza_restaurant: 'Pizza',
  steak_house: 'Steakhouse',
  barbecue_restaurant: 'Barbecue',
  seafood_restaurant: 'Seafood',
  ramen_restaurant: 'Ramen',
  sushi_restaurant: 'Sushi',
  breakfast_restaurant: 'Breakfast & brunch',
  brunch_restaurant: 'Breakfast & brunch',
  buffet_restaurant: 'Buffet',
  vegan_restaurant: 'Vegan',
  vegetarian_restaurant: 'Vegetarian',
  fine_dining_restaurant: 'Fine dining',
}
function categoryFromTypes(types) {
  for (const type of types ?? []) {
    if (CATEGORY_NAMES[type]) return CATEGORY_NAMES[type]
    if (type.endsWith('_restaurant') && type !== 'restaurant') {
      const cuisine = type.slice(0, -'_restaurant'.length).replaceAll('_', ' ')
      return cuisine.charAt(0).toUpperCase() + cuisine.slice(1)
    }
  }
  return ''
}

// At most 30 searches a minute per user (typing is debounced, so real use is far lower)
const searchLimit = perUserLimit({
  limit: 30,
  windowMs: 60 * 1000,
  message: 'Too many searches. Wait a moment and try again.',
})

const photoLimit = perUserLimit({
  limit: 30,
  windowMs: 60 * 1000,
  message: 'Too many photo requests. Wait a moment and try again.',
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
        locationBias: SEARCH_AREA,
        ...(REGION ? { includedRegionCodes: [REGION], regionCode: REGION } : {}),
      }),
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    return res.status(502).json({ error: 'Google search did not respond. Try again.' })
  }

  if (!response.ok) {
    // Upstream error bodies can contain request details, so log only the status.
    console.error(`Google Places error ${response.status}`)
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
      category: categoryFromTypes(prediction.types),
    }))
    .filter((place) => place.name)

  res.json({ places })
})

// The server mount requires authentication. Photo resource names are ephemeral and
// stay server-side: every lookup obtains a fresh name from Place Details.
router.get('/:placeId/photo', (req, res, next) => {
  res.set('Cache-Control', 'private, no-store')
  next()
}, photoLimit, async (req, res) => {
  const { placeId } = req.params
  if (!PLACE_ID.test(placeId)) return res.status(400).json({ error: 'The restaurant ID is not valid.' })
  if (!isConfigured) return res.status(503).json({ error: 'Google restaurant photos are not set up yet.' })

  try {
    const details = await googlePhotoJson(`https://places.googleapis.com/v1/places/${placeId}`, 'photos')
    if (details?.photos == null || (Array.isArray(details.photos) && details.photos.length === 0)) {
      return res.json({ photo: null })
    }
    if (!Array.isArray(details.photos)) throw new Error('Invalid photo response')
    const selected = details.photos[0]
    const prefix = `places/${placeId}/photos/`
    if (typeof selected?.name !== 'string' || !selected.name.startsWith(prefix) || !PHOTO_RESOURCE.test(selected.name.slice(prefix.length))) {
      throw new Error('Invalid photo resource')
    }
    // ?size=large is for the wide banner on the entry ticket
    const width = req.query.size === 'large' ? 800 : 400
    const media = await googlePhotoJson(`https://places.googleapis.com/v1/${selected.name}/media?maxWidthPx=${width}&skipHttpRedirect=true`)
    const url = safeGoogleUrl(media?.photoUri)
    if (!url) throw new Error('Invalid photo URL')
    if (selected.authorAttributions != null && !Array.isArray(selected.authorAttributions)) throw new Error('Invalid photo attribution')
    const attributions = (selected.authorAttributions || []).map((author) => {
      const name = typeof author?.displayName === 'string' ? author.displayName.trim().slice(0, 160) : ''
      return {
        name: name && !name.includes(API_KEY) ? name : 'Photo contributor',
        url: safeGoogleUrl(author?.uri, 'author'),
      }
    })
    return res.json({ photo: { url, sourceUrl: safeGoogleUrl(selected.googleMapsUri, 'source'), attributions } })
  } catch {
    // Neither the upstream body nor request URL is exposed or logged on failures.
    return res.status(502).json({ error: PHOTO_ERROR })
  }
})

module.exports = { router, categoryFromTypes }
