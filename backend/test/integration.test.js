const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createSandbox } = require('./sandbox')

test('profiles, follows, review sharing and media boundaries against Postgres', async (t) => {
  const sandbox = await createSandbox()
  t.after(() => sandbox.close())
  const {
    users: [alex, bea, casey],
    request,
    pool,
    rewrite,
  } = sandbox
  let photo, saved, privateSaved
  const ticket = {
    place: { name: 'Corner Cafe', address: 'Angeles City' },
    date: '2026-10-03',
    rating: 5,
    notes: 'A lovely coffee and a warm table.',
    dishes: [{ name: 'Coffee', price: 120 }],
  }
  // A small JPEG marker buffer tests storage/access; real encoding is verified in the browser.
  const image = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9])

  await t.test('all social and media endpoints require authentication', async () => {
    for (const route of [
      '/api/profiles/me',
      '/api/profiles',
      '/api/profiles/feed',
      '/api/media/00000000-0000-0000-0000-000000000000',
    ])
      assert.equal((await request(null, route)).status, 401)
  })
  await t.test('profile creation is idempotent and does not expose email', async () => {
    for (const user of [alex, bea, casey]) {
      const first = await request(user, '/api/profiles/me')
      assert.equal(first.status, 200)
      assert.ok(first.data.profile.handle.length <= 30)
      assert.equal(first.data.profile.email, undefined)
      assert.deepEqual((await request(user, '/api/profiles/me')).data, first.data)
    }
  })
  await t.test('profile editing, duplicate handles and text limits', async () => {
    const edited = await request(alex, '/api/profiles/me', {
      method: 'PATCH',
      body: {
        name: 'Alex',
        handle: 'alex_eats',
        bio: 'Coffee, noodles and little discoveries.',
        topPickIds: [],
      },
    })
    assert.equal(edited.data.profile.bio, 'Coffee, noodles and little discoveries.')
    assert.equal(
      (
        await request(bea, '/api/profiles/me', {
          method: 'PATCH',
          body: { name: 'Bea', handle: 'alex_eats', bio: '' },
        })
      ).status,
      409,
    )
    assert.equal(
      (
        await request(alex, '/api/profiles/me', {
          method: 'PATCH',
          body: { name: 'Alex', handle: 'alex_eats', bio: 'x'.repeat(281) },
        })
      ).status,
      400,
    )
  })
  await t.test('follow is idempotent, updates counts and prevents self-follow', async () => {
    assert.equal((await request(alex, `/api/profiles/${alex}/follow`, { method: 'PUT' })).status, 400)
    for (let n = 0; n < 2; n++)
      assert.equal(
        (await request(alex, `/api/profiles/${bea}/follow`, { method: 'PUT' })).data.profile.followerCount,
        1,
      )
    assert.equal((await request(alex, '/api/profiles/me')).data.profile.followingCount, 1)
    assert.equal(
      (await request(bea, `/api/profiles/${bea}/connections?type=followers`)).data.profiles[0].id,
      alex,
    )
    assert.equal((await request(alex, '/api/profiles?q=Bea')).data.profiles[0].id, bea)
  })
  await t.test('upload rejects invalid and oversized images; unbound uploads are private', async () => {
    assert.equal(
      (await request(bea, '/api/media', { method: 'POST', raw: Buffer.from('not an image') })).status,
      400,
    )
    assert.equal(
      (await request(bea, '/api/media', { method: 'POST', raw: Buffer.alloc(750001) })).status,
      413,
    )
    const uploaded = await request(bea, '/api/media', { method: 'POST', raw: image })
    assert.equal(uploaded.status, 201)
    photo = uploaded.data.id
    assert.equal((await request(alex, `/api/media/${photo}`)).status, 404)
  })
  await t.test('foreign photo attachments roll back the complete ticket', async () => {
    assert.equal(
      (await request(alex, '/api/visits', { method: 'POST', body: { ...ticket, photoIds: [photo] } })).status,
      400,
    )
    assert.equal((await request(alex, '/api/restaurants')).data.restaurants.length, 0)
  })
  await t.test('private reviews and photos stay out of profiles and both feeds', async () => {
    saved = (await request(bea, '/api/visits', { method: 'POST', body: { ...ticket, photoIds: [photo] } }))
      .data
    assert.equal(saved.visit.isPublic, false)
    assert.equal(saved.visit.date, ticket.date)
    assert.equal((await request(alex, `/api/profiles/${bea}`)).data.reviews.length, 0)
    assert.equal((await request(alex, '/api/profiles/feed?scope=following')).data.reviews.length, 0)
    assert.equal((await request(alex, '/api/profiles/feed?scope=discover')).data.reviews.length, 0)
    assert.equal((await request(alex, `/api/media/${photo}`)).status, 404)
    assert.equal(
      (await request(alex, `/api/visits/${saved.visit.id}`, { method: 'PATCH', body: { isPublic: true } }))
        .status,
      404,
    )
  })
  await t.test('published reviews show on profiles and feeds with dishes and photos', async () => {
    await request(bea, `/api/visits/${saved.visit.id}`, { method: 'PATCH', body: { isPublic: true } })
    const profile = (await request(alex, `/api/profiles/${bea}`)).data
    assert.equal(profile.reviews[0].dishes[0].name, 'Coffee')
    assert.equal(profile.reviews[0].date, ticket.date)
    assert.deepEqual(profile.reviews[0].photoIds, [photo])
    assert.equal(profile.restaurants[0].reviewCount, 1)
    assert.equal((await request(alex, '/api/profiles/feed?scope=following')).data.reviews[0].author.id, bea)
    assert.equal((await request(casey, '/api/profiles/feed?scope=following')).data.reviews.length, 0)
    assert.equal((await request(casey, '/api/profiles/feed?scope=discover')).data.reviews.length, 1)
    const readable = await request(alex, `/api/media/${photo}`)
    assert.equal(readable.status, 200)
    assert.deepEqual(readable.data, image)
    assert.equal(readable.headers.get('cache-control'), 'private, no-store')
    assert.equal((await request(alex, `/api/media/${photo}`, { method: 'DELETE' })).status, 404)
  })
  await t.test('top picks accept only own restaurants with a shared review', async () => {
    const body = {
      name: 'Bea Santos',
      handle: 'bea_eats',
      bio: 'Coffee person.',
      topPickIds: [saved.restaurant.id],
    }
    assert.equal((await request(bea, '/api/profiles/me', { method: 'PATCH', body })).status, 200)
    assert.equal(
      (await request(alex, '/api/profiles/me', { method: 'PATCH', body: { ...body, handle: 'alex_eats' } }))
        .status,
      400,
    )
    privateSaved = (
      await request(bea, '/api/visits', {
        method: 'POST',
        body: { ...ticket, place: { name: 'Private Restaurant' } },
      })
    ).data
    assert.equal(
      (
        await request(bea, '/api/profiles/me', {
          method: 'PATCH',
          body: { ...body, topPickIds: [privateSaved.restaurant.id] },
        })
      ).status,
      400,
    )
  })
  await t.test('unsharing revokes photo access and removes public restaurant summaries', async () => {
    await request(bea, `/api/visits/${saved.visit.id}`, { method: 'PATCH', body: { isPublic: false } })
    assert.equal((await request(alex, `/api/media/${photo}`)).status, 404)
    const profile = (await request(alex, `/api/profiles/${bea}`)).data
    assert.equal(profile.reviews.length, 0)
    assert.equal(profile.restaurants.length, 0)
    assert.equal(profile.profile.reviewCount, 0)
    assert.equal((await request(bea, '/api/visits')).data.visits.length, 2)
  })
  await t.test('avatar replacement deletes old media and stays visible to members', async () => {
    const first = await request(bea, '/api/media/avatar', { method: 'PUT', raw: image })
    assert.equal((await request(alex, `/api/media/${first.data.id}`)).status, 200)
    const second = await request(bea, '/api/media/avatar', { method: 'PUT', raw: image })
    assert.notEqual(first.data.id, second.data.id)
    assert.equal((await request(bea, `/api/media/${first.data.id}`)).status, 404)
    assert.equal((await request(bea, '/api/profiles/me')).data.profile.avatarId, second.data.id)
  })
  await t.test('unfollow is idempotent and removes the following-feed relationship', async () => {
    for (let n = 0; n < 2; n++)
      assert.equal(
        (await request(alex, `/api/profiles/${bea}/follow`, { method: 'DELETE' })).data.profile.followerCount,
        0,
      )
    assert.equal((await request(alex, '/api/profiles/me')).data.profile.followingCount, 0)
  })
  await t.test('schema setup remains safe to run twice', async () => {
    const fs = require('node:fs')
    const path = require('node:path')
    await pool.query(rewrite(fs.readFileSync(path.join(__dirname, '../database_setup.sql'), 'utf8')))
    assert.equal((await request(bea, '/api/visits')).data.visits.length, 2)
  })
})
