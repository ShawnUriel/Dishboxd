const { test } = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')

const PLACE_ID = 'ChIJ2fzCmcW7j4AR2JzfXBBoh6E'
const PHOTO_NAME = `places/${PLACE_ID}/photos/FreshPhoto_Reference-123`
const IMAGE_URL = 'https://lh3.googleusercontent.com/places/real-photo=w400'
const SOURCE_URL = 'https://www.google.com/maps/place/?q=place_id:ChIJ2fzCmcW7j4AR2JzfXBBoh6E&photo=example'
const TEST_KEY = 'private-test-key-not-for-the-browser'
const realFetch = global.fetch

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

test('Google restaurant photos use fresh resources and safe public responses', async (t) => {
  const previousKey = process.env.GOOGLE_PLACES_API_KEY
  process.env.GOOGLE_PLACES_API_KEY = TEST_KEY
  const modulePath = require.resolve('../routes/places')
  delete require.cache[modulePath]
  const { router } = require('../routes/places')
  const app = express()
  app.use('/api/places', (req, res, next) => {
    if (!req.headers.authorization) return res.status(401).json({ error: 'Sign in first.' })
    req.userId = req.headers.authorization
    next()
  }, router)
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener))
  })
  const origin = `http://127.0.0.1:${server.address().port}`
  t.after(async () => {
    global.fetch = realFetch
    if (previousKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY
    else process.env.GOOGLE_PLACES_API_KEY = previousKey
    delete require.cache[modulePath]
    await new Promise((resolve) => server.close(resolve))
  })
  let requests = []
  let userNumber = 0
  function upstream(...responses) {
    requests = []
    global.fetch = async (url, options) => {
      requests.push({ url: String(url), options })
      const reply = responses.shift()
      if (typeof reply === 'function') return reply(url, options)
      if (!reply) throw new Error('Unexpected upstream request')
      return reply
    }
  }
  async function request(id = PLACE_ID, user = `user-${++userNumber}`) {
    const response = await realFetch(`${origin}/api/places/${encodeURIComponent(id)}/photo`, {
      headers: user ? { Authorization: user } : {},
    })
    return { status: response.status, data: await response.json(), headers: response.headers }
  }
  function assertSanitized(result) {
    const body = JSON.stringify(result.data)
    assert.equal(body.includes(TEST_KEY), false)
    assert.equal(body.includes(PHOTO_NAME), false)
    assert.equal(result.headers.get('cache-control'), 'private, no-store')
  }

  await t.test('authentication is required before any paid lookup', async () => {
    upstream()
    assert.equal((await request(PLACE_ID, null)).status, 401)
    assert.equal(requests.length, 0)
  })

  await t.test('cuisine lookup uses specific Google types, stays optional and protects the key', async () => {
    const { cuisineFromTypes } = require('../cuisines')
    assert.equal(cuisineFromTypes(['cafe', 'japanese_restaurant']), 'Japanese')
    assert.equal(cuisineFromTypes(['korean_barbecue_restaurant', 'restaurant']), 'Korean')
    assert.equal(cuisineFromTypes(['pizza_restaurant', 'hamburger_restaurant', 'food']), '')
    assert.equal(cuisineFromTypes(['japanese_restaurant', 'korean_restaurant']), '')
    assert.equal(cuisineFromTypes(['japanese_restaurant', 'korean_restaurant'], 'korean_restaurant'), 'Korean')
    const lookup = async (id = PLACE_ID, authenticated = true) => {
      const response = await realFetch(`${origin}/api/places/${id}/cuisine`, { headers: authenticated ? { Authorization: `cuisine-${++userNumber}` } : {} })
      return { status: response.status, data: await response.json(), headers: response.headers }
    }
    upstream()
    assert.equal((await lookup(PLACE_ID, false)).status, 401)
    assert.equal((await lookup('bad!')).status, 400)
    assert.equal(requests.length, 0)
    upstream(json({ types: ['cafe', 'japanese_restaurant'], primaryType: 'cafe' }))
    const result = await lookup()
    assert.equal(result.status, 200)
    assert.deepEqual(result.data, { cuisine: 'Japanese' })
    assert.equal(requests[0].options.headers['X-Goog-FieldMask'], 'types,primaryType')
    assertSanitized(result)
    upstream(json({ types: ['restaurant', 'food'] }))
    assert.deepEqual((await lookup()).data, { cuisine: '' })
    upstream(json({ error: TEST_KEY }, 403))
    const failed = await lookup()
    assert.equal(failed.status, 502)
    assertSanitized(failed)
  })

  await t.test('returns a photo and all attributions with a fresh Details request', async () => {
    const details = { photos: [{ name: PHOTO_NAME, googleMapsUri: SOURCE_URL, authorAttributions: [
      { displayName: 'A restaurant guest', uri: '//maps.google.com/maps/contrib/101563' },
      { displayName: 'The owner', uri: 'https://www.google.com/maps/contrib/202345?hl=en' },
    ] }] }
    upstream(json(details), json({ name: `${PHOTO_NAME}/media`, photoUri: IMAGE_URL }))
    const result = await request()
    assert.equal(result.status, 200)
    assert.deepEqual(result.data, { photo: { url: IMAGE_URL, sourceUrl: SOURCE_URL, attributions: [
      { name: 'A restaurant guest', url: 'https://maps.google.com/maps/contrib/101563' },
      { name: 'The owner', url: 'https://www.google.com/maps/contrib/202345' },
    ] } })
    assertSanitized(result)
    assert.equal(requests.length, 2)
    assert.equal(requests[0].url, `https://places.googleapis.com/v1/places/${PLACE_ID}`)
    assert.equal(requests[0].options.headers['X-Goog-FieldMask'], 'photos')
    assert.equal(requests[1].url, `https://places.googleapis.com/v1/${PHOTO_NAME}/media?maxWidthPx=400&skipHttpRedirect=true`)
    for (const { url, options } of requests) {
      assert.equal(options.headers['X-Goog-Api-Key'], TEST_KEY)
      assert.equal(url.includes(TEST_KEY), false)
      assert.equal(options.redirect, 'error')
      assert.equal(options.cache, 'no-store')
      assert.ok(options.signal instanceof AbortSignal)
    }
    upstream(json(details), json({ photoUri: IMAGE_URL }))
    assert.equal((await request()).status, 200)
    assert.equal(requests.length, 2, 'Repeated lookup must fetch a new photo resource')
  })

  await t.test('the entry ticket can ask for a wider photo; any other size value is ignored', async () => {
    const details = { photos: [{ name: PHOTO_NAME }] }
    for (const [query, width] of [['?size=large', 800], ['?size=huge', 400], ['?size=800', 400], ['', 400]]) {
      upstream(json(details), json({ photoUri: IMAGE_URL }))
      const response = await realFetch(`${origin}/api/places/${PLACE_ID}/photo${query}`, {
        headers: { Authorization: `size-check${query}` },
      })
      assert.equal(response.status, 200)
      assert.equal(requests[1].url, `https://places.googleapis.com/v1/${PHOTO_NAME}/media?maxWidthPx=${width}&skipHttpRedirect=true`)
    }
  })

  await t.test('a place without photos returns null and does not call the media endpoint', async () => {
    for (const details of [{}, { photos: [] }]) {
      upstream(json(details))
      const result = await request()
      assert.equal(result.status, 200)
      assert.deepEqual(result.data, { photo: null })
      assert.equal(requests.length, 1)
      assertSanitized(result)
    }
  })

  await t.test('invalid IDs cannot become upstream paths or URLs', async () => {
    for (const id of ['short', '../etc/passwd', 'https://attacker.test/photo', `${PLACE_ID}?key=bad`, 'x'.repeat(513)]) {
      upstream()
      const result = await request(id)
      assert.equal(result.status, 400)
      assert.equal(requests.length, 0)
      assertSanitized(result)
    }
  })

  await t.test('upstream errors and invalid JSON become generic errors', async () => {
    for (const reply of [json({ error: TEST_KEY }, 403), new Response('not JSON'), () => { throw new Error(TEST_KEY) }]) {
      upstream(reply)
      const result = await request()
      assert.equal(result.status, 502)
      assert.deepEqual(result.data, { error: 'Restaurant photos are unavailable right now. Try again later.' })
      assertSanitized(result)
    }
    upstream(json({ photos: [{ name: PHOTO_NAME }] }), json({ error: TEST_KEY }, 429))
    const result = await request()
    assert.equal(result.status, 502)
    assertSanitized(result)
  })

  await t.test('upstream requests abort after a short timeout', async () => {
    upstream((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    }))
    const started = Date.now()
    const result = await request()
    assert.equal(result.status, 502)
    assert.ok(Date.now() - started < 6000)
    assert.equal(requests[0].options.signal.aborted, true)
    assertSanitized(result)
  })

  await t.test('unsafe photo names never cause a second upstream request', async () => {
    for (const name of ['https://attacker.test/image', `places/AnotherPlace/photos/photo`, `${PHOTO_NAME}/../../secret`, `${PHOTO_NAME}?key=${TEST_KEY}`]) {
      upstream(json({ photos: [{ name }] }))
      const result = await request()
      assert.equal(result.status, 502)
      assert.equal(requests.length, 1)
      assertSanitized(result)
    }
  })

  await t.test('unsafe media URLs and accidentally echoed keys never reach the browser', async () => {
    for (const photoUri of [
      'http://lh3.googleusercontent.com/photo',
      'https://googleusercontent.com.attacker.test/photo',
      'https://attacker.test/photo',
      'https://user:password@lh3.googleusercontent.com/photo',
      'https://lh3.googleusercontent.com:8443/photo',
      `https://lh3.googleusercontent.com/photo?key=${TEST_KEY}`,
      `https://lh3.googleusercontent.com/${TEST_KEY}`,
      'javascript:alert(1)',
    ]) {
      upstream(json({ photos: [{ name: PHOTO_NAME }] }), json({ photoUri }))
      const result = await request()
      assert.equal(result.status, 502)
      assertSanitized(result)
    }
  })

  await t.test('unsafe attribution links retain the author credit as plain text', async () => {
    const authors = [
      { displayName: 'Guest one', uri: 'javascript:alert(1)' },
      { displayName: 'Guest two', uri: 'https://google.com.attacker.test/maps/contrib/123' },
      { displayName: 'Guest three', uri: 'https://www.google.com/url?url=https://attacker.test' },
      { displayName: TEST_KEY, uri: `https://maps.google.com/maps/contrib/123?key=${TEST_KEY}` },
    ]
    upstream(json({ photos: [{ name: PHOTO_NAME, authorAttributions: authors }] }), json({ photoUri: IMAGE_URL }))
    const result = await request()
    assert.equal(result.status, 200)
    assert.equal(result.data.photo.sourceUrl, null)
    assert.deepEqual(result.data.photo.attributions, [
      { name: 'Guest one', url: null },
      { name: 'Guest two', url: null },
      { name: 'Guest three', url: null },
      { name: 'Photo contributor', url: null },
    ])
    assertSanitized(result)
  })

  await t.test('unsafe Google Maps source links are discarded', async () => {
    for (const googleMapsUri of [
      'https://www.google.com.attacker.test/maps/place/anything',
      'http://www.google.com/maps/place/anything',
      'https://www.google.com/url?q=https://attacker.test',
      'https://www.google.com/maps?continue=https://attacker.test',
      `https://www.google.com/maps?key=${TEST_KEY}`,
      'javascript:alert(1)',
    ]) {
      upstream(json({ photos: [{ name: PHOTO_NAME, googleMapsUri }] }), json({ photoUri: IMAGE_URL }))
      const result = await request()
      assert.equal(result.status, 200)
      assert.equal(result.data.photo.sourceUrl, null)
      assertSanitized(result)
    }
  })

  await t.test('a user can make at most 30 photo lookups per minute', async () => {
    for (let index = 0; index < 30; index++) {
      upstream(json({ photos: [] }))
      assert.equal((await request(PLACE_ID, 'rate-limited-user')).status, 200)
    }
    upstream()
    const result = await request(PLACE_ID, 'rate-limited-user')
    assert.equal(result.status, 429)
    assert.ok(Number(result.headers.get('retry-after')) > 0)
    assert.equal(requests.length, 0)
    assertSanitized(result)
    upstream(json({ photos: [] }))
    assert.equal((await request(PLACE_ID, 'another-user')).status, 200)
  })
})
