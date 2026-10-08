const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createSandbox } = require('./sandbox')

test('settings persist and private accounts protect every review access path', async t => {
  const sandbox = await createSandbox()
  t.after(() => sandbox.close())
  const { request, pool, users: [alex, bea, casey] } = sandbox
  for (const user of sandbox.users) await request(user, '/api/profiles/me')
  const settings = async (user, body) => request(user, '/api/settings', body ? { method: 'PATCH', body } : {})
  const follow = async (a, b) => request(a, `/api/profiles/${b}/follow`, { method: 'PUT' })
  const ticket = { place: { name: 'Secret supper', address: 'Quiet Lane' }, category: 'Italian', date: '2026-10-08', rating: 5, notes: 'Friends at my table.', dishes: [{ name: 'Pasta', price: 100, score: 9 }], isPublic: true }
  const review = (await request(alex, '/api/visits', { method: 'POST', body: ticket })).data.visit
  const privateReview = (await request(alex, '/api/visits', { method: 'POST', body: { ...ticket, isPublic: false } })).data.visit
  const photo = (await pool.query("INSERT INTO media (user_id,visit_id,kind,data) VALUES ($1,$2,'review',$3) RETURNING id", [alex, review.id, Buffer.from('photo')])).rows[0].id
  const sticker = (await pool.query("INSERT INTO stickers (user_id,style,data) VALUES ($1,'original',$2) RETURNING id", [alex, Buffer.from('test-image')])).rows[0].id
  await pool.query('INSERT INTO sticker_placements (user_id,sticker_id,visit_id,x,y) VALUES ($1,$2,$3,20,30)', [alex, sticker, review.id])
  await request(alex, '/api/profiles/me/top-picks', { method: 'PUT', body: { picks: [{ category: 'Italian', restaurantId: review.restaurantId, dish: 'Pasta' }] } })
  await follow(bea, alex)
  await follow(casey, bea)
  await request(bea, `/api/reviews/${review.id}/repost`, { method: 'PUT' })
  await request(bea, `/api/reviews/${review.id}/comments`, { method: 'POST', body: { body: 'Dinner soon?' } })
  await request(alex, `/api/reviews/${review.id}/comments`, { method: 'POST', body: { body: 'Yes!', parentId: (await request(bea, `/api/reviews/${review.id}/comments`)).data.comments[0].id } })

  await t.test('authentication, validation, partial saves and account isolation', async () => {
    assert.equal((await settings(null)).status, 401)
    assert.equal((await settings(null, { theme: 'dark' })).status, 401)
    assert.deepEqual((await settings(alex)).data.settings, { isPrivate: false, theme: 'system', reduceMotion: false, defaultReviewPublic: false })
    for (const invalid of [{ theme: 'other' }, { isPrivate: 'true' }, { reduceMotion: 1 }, { defaultReviewPublic: null }, { userId: bea }, {}]) assert.equal((await settings(alex, invalid)).status, 400)
    assert.equal((await settings(alex, { theme: 'dark', reduceMotion: true, defaultReviewPublic: true })).status, 200)
    assert.equal((await settings(alex, { isPrivate: true })).data.settings.theme, 'dark')
    assert.equal((await settings(alex)).data.settings.defaultReviewPublic, true)
    assert.equal((await settings(bea)).data.settings.isPrivate, false)
    assert.equal((await settings(bea)).data.settings.theme, 'system')
  })

  async function denied(user) {
    for (const route of [`/api/reviews/${review.id}`, `/api/reviews/${review.id}/comments`, `/api/media/${photo}`, `/api/stickers/${sticker}/image`]) assert.equal((await request(user, route)).status, 404, route)
    for (const action of ['like', 'repost']) assert.equal((await request(user, `/api/reviews/${review.id}/${action}`, { method: 'PUT' })).status, 404)
    assert.equal((await request(user, `/api/reviews/${review.id}/comments`, { method: 'POST', body: { body: 'No access' } })).status, 404)
    assert.equal((await request(user, '/api/bookmarks', { method: 'POST', body: { restaurantId: review.restaurantId } })).status, 404)
    for (const scope of ['foryou', 'following', 'discover']) assert.ok(!(await request(user, `/api/profiles/feed?scope=${scope}`)).data.reviews.some(item => item.id === review.id))
    const profile = (await request(user, `/api/profiles/${alex}`)).data
    assert.equal(profile.restricted, true)
    for (const field of ['reviews', 'reposts', 'restaurants', 'topPicks', 'stickers']) assert.deepEqual(profile[field], [])
    assert.equal(profile.profile.reviewCount, 0)
    assert.equal((await request(user, `/api/profiles/${alex}/connections`)).data.profiles.length, 0)
  }

  await t.test('existing public reviews become hidden from strangers and one-way followers', async () => {
    await denied(casey)
    await denied(bea)
    const repostProfile = (await request(casey, `/api/profiles/${bea}`)).data
    assert.ok(!repostProfile.reposts.some(item => item.id === review.id))
    const notifications = (await request(bea, '/api/notifications')).data.notifications
    assert.ok(!notifications.some(item => item.reviewId === review.id))
    assert.equal((await request(alex, `/api/reviews/${review.id}`)).status, 200)
    assert.equal((await request(alex, `/api/media/${photo}`)).status, 200)
  })

  await t.test('mutual friends can view shared content but not Only me reviews', async () => {
    await follow(alex, bea)
    for (const route of [`/api/reviews/${review.id}`, `/api/reviews/${review.id}/comments`, `/api/media/${photo}`, `/api/stickers/${sticker}/image`]) assert.equal((await request(bea, route)).status, 200, route)
    assert.equal((await request(bea, `/api/reviews/${privateReview.id}`)).status, 404)
    const profile = (await request(bea, `/api/profiles/${alex}`)).data
    assert.equal(profile.reviews.length, 1)
    assert.equal(profile.topPicks.length, 1)
    assert.equal(profile.restaurants.length, 1)
    assert.ok((await request(bea, '/api/profiles/feed?scope=discover')).data.reviews.some(item => item.id === review.id))
    await denied(casey)
    assert.equal((await request(bea, `/api/reviews/${review.id}/repost`, { method: 'PUT' })).status, 200)
    assert.ok(!(await request(casey, `/api/profiles/${bea}`)).data.reposts.some(item => item.id === review.id))
  })

  await t.test('unfollowing revokes access, including prior co-author invitations', async () => {
    await request(alex, `/api/reviews/${review.id}/coauthor`, { method: 'PUT', body: { userId: bea } })
    assert.equal((await request(bea, '/api/reviews/invites')).data.invites.length, 1)
    await request(alex, `/api/profiles/${bea}/follow`, { method: 'DELETE' })
    await denied(bea)
    assert.equal((await request(bea, '/api/reviews/invites')).data.invites.length, 0)
    assert.equal((await request(bea, `/api/reviews/${review.id}/coauthor/accept`, { method: 'POST' })).status, 404)
  })

  await t.test('switching back to public restores only shared reviews', async () => {
    await settings(alex, { isPrivate: false })
    assert.equal((await request(casey, `/api/reviews/${review.id}`)).status, 200)
    assert.equal((await request(casey, `/api/reviews/${privateReview.id}`)).status, 404)
    assert.equal((await settings(alex)).data.settings.theme, 'dark')
    assert.equal((await request(alex, '/api/visits')).data.visits.length, 2)
  })
})
