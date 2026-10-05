const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createSandbox } = require('./sandbox')
const { categoryFromTypes } = require('../routes/places')

// A PNG signature followed by bytes: storage and access are tested here; real stickers are made in the browser.
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('sticker')])

test('Google types become a starting category', () => {
  assert.equal(categoryFromTypes(['coffee_shop', 'cafe', 'food', 'store']), 'Coffee shop')
  assert.equal(categoryFromTypes(['italian_restaurant', 'restaurant', 'food']), 'Italian')
  assert.equal(categoryFromTypes(['restaurant', 'middle_eastern_restaurant']), 'Middle eastern')
  assert.equal(categoryFromTypes(['food', 'point_of_interest']), '')
  assert.equal(categoryFromTypes(undefined), '')
})

test('item reviews, categories, boxes, stickers, likes, reposts and co-reviews against Postgres', async (t) => {
  const sandbox = await createSandbox()
  t.after(() => sandbox.close())
  const {
    users: [alex, bea, casey],
    request,
  } = sandbox
  const ticket = {
    place: { name: 'Leaf & Whisk', address: 'Angeles City' },
    category: 'Matcha bar',
    date: '2026-10-04',
    rating: 5,
    notes: 'The ceremonial matcha was something else.',
    dishes: [
      { name: 'Spanish latte', price: 165, score: 11, description: 'Silky, not too sweet.' },
      { name: 'Classic fries', price: 120, score: 7 },
      { name: 'Water', price: 0 },
    ],
  }
  let alexSticker, beaSticker, visit, restaurant, box, privateVisit

  for (const user of [alex, bea, casey]) await request(user, '/api/profiles/me')

  await t.test('every new endpoint requires authentication', async () => {
    for (const [route, method] of [
      ['/api/stickers', 'GET'],
      ['/api/stickers/placements', 'POST'],
      ['/api/reviews/invites', 'GET'],
      ['/api/profiles/friends', 'GET'],
      [`/api/reviews/${alex}/like`, 'PUT'],
    ])
      assert.equal((await request(null, route, { method })).status, 401)
  })

  await t.test('each item keeps its own score and note, and the place its category', async () => {
    const saved = await request(alex, '/api/visits', { method: 'POST', body: { ...ticket, isPublic: true } })
    assert.equal(saved.status, 201)
    visit = saved.data.visit
    restaurant = saved.data.restaurant
    assert.equal(restaurant.category, 'Matcha bar')
    assert.deepEqual(
      visit.dishes.map(({ name, score, description }) => ({ name, score, description })),
      [
        { name: 'Spanish latte', score: 11, description: 'Silky, not too sweet.' },
        { name: 'Classic fries', score: 7, description: '' },
        { name: 'Water', score: null, description: '' },
      ],
    )
    assert.equal(visit.restaurant.category, 'Matcha bar')
    const journal = await request(alex, '/api/visits')
    assert.equal(journal.data.visits[0].dishes[0].score, 11)
    assert.equal((await request(alex, '/api/restaurants')).data.restaurants[0].category, 'Matcha bar')
  })

  await t.test('scores stop at 12 and must be whole numbers', async () => {
    for (const score of [13, -1, 7.5, 'ten']) {
      const body = { ...ticket, place: { name: 'Nowhere' }, dishes: [{ name: 'Tea', price: 1, score }] }
      assert.equal((await request(alex, '/api/visits', { method: 'POST', body })).status, 400)
    }
    assert.equal((await request(alex, '/api/restaurants')).data.restaurants.length, 1)
  })

  await t.test('categories can be changed by the owner only', async () => {
    const route = `/api/restaurants/${restaurant.id}`
    assert.equal((await request(bea, route, { method: 'PATCH', body: { category: 'Cafe' } })).status, 404)
    const changed = await request(alex, route, { method: 'PATCH', body: { category: '  Tea   house ' } })
    assert.equal(changed.data.restaurant.category, 'Tea house')
    assert.equal((await request(alex, route, { method: 'PATCH', body: { category: 'x'.repeat(41) } })).status, 400)
    // A category chosen on a later ticket also sorts the place already on file
    const again = await request(alex, '/api/visits', {
      method: 'POST',
      body: { ...ticket, place: undefined, restaurantId: restaurant.id, category: 'Matcha bar' },
    })
    assert.equal(again.data.restaurant.category, 'Matcha bar')
    privateVisit = again.data.visit
    assert.equal(privateVisit.isPublic, false)
  })

  await t.test('box descriptions, names and colours are editable by their owner', async () => {
    box = (await request(alex, '/api/boxes', { method: 'POST', body: { title: 'Matcha run' } })).data.box
    assert.deepEqual(box.stickers, [])
    const route = `/api/boxes/${box.id}`
    const edited = await request(alex, route, {
      method: 'PATCH',
      body: { description: 'Every matcha worth a detour.', color: '#3366CC' },
    })
    assert.equal(edited.data.box.description, 'Every matcha worth a detour.')
    assert.equal(edited.data.box.color, '#3366cc')
    assert.equal(edited.data.box.title, 'Matcha run')
    assert.equal((await request(alex, route, { method: 'PATCH', body: { color: 'mint' } })).data.box.color, 'mint')
    assert.equal((await request(alex, route, { method: 'PATCH', body: { color: 'red' } })).status, 400)
    assert.equal((await request(alex, route, { method: 'PATCH', body: {} })).status, 400)
    assert.equal((await request(bea, route, { method: 'PATCH', body: { description: 'Mine now' } })).status, 404)
    const cleared = await request(alex, route, { method: 'PATCH', body: { description: '' } })
    assert.equal(cleared.data.box.description, '')
  })

  await t.test('only PNG stickers in a known style go into the sticker book', async () => {
    const upload = (user, style, raw, type = 'image/png') =>
      fetch(`${sandbox.url}/api/stickers?style=${style}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user}`, 'Content-Type': type },
        body: raw,
      })
    assert.equal((await upload(alex, 'pixel', Buffer.from('not a png'))).status, 400)
    assert.equal((await upload(alex, 'glitter', PNG)).status, 400)
    assert.equal((await upload(alex, 'pixel', PNG, 'image/jpeg')).status, 400)
    assert.equal((await upload(alex, 'pixel', Buffer.concat([PNG, Buffer.alloc(400000)]))).status, 413)
    const made = await upload(alex, 'pixel', PNG)
    assert.equal(made.status, 201)
    alexSticker = (await made.json()).sticker
    assert.equal(alexSticker.style, 'pixel')
    beaSticker = (await (await upload(bea, 'translucent', PNG)).json()).sticker
    const book = await request(alex, '/api/stickers')
    assert.deepEqual(book.data.stickers.map((sticker) => sticker.id), [alexSticker.id])
  })

  await t.test('stickers go only on your own cards, and private cards keep them private', async () => {
    const place = (user, stickerId, type, id, extra = {}) =>
      request(user, '/api/stickers/placements', {
        method: 'POST',
        body: { stickerId, target: { type, id }, x: 20, y: 30, rotation: 8, scale: 1.2, ...extra },
      })
    const image = (user, id = alexSticker.id) => request(user, `/api/stickers/${id}/image`)

    const onBox = await place(alex, alexSticker.id, 'box', box.id)
    assert.equal(onBox.status, 201)
    assert.deepEqual(
      {
        x: onBox.data.placement.x,
        y: onBox.data.placement.y,
        rotation: onBox.data.placement.rotation,
        scale: onBox.data.placement.scale,
      },
      { x: 20, y: 30, rotation: 8, scale: 1.2 },
    )
    assert.equal((await request(alex, '/api/boxes')).data.boxes[0].stickers[0].stickerId, alexSticker.id)
    // Used only on a private box: nobody else can load it
    assert.equal((await image(alex)).status, 200)
    assert.equal((await image(bea)).status, 404)

    assert.equal((await place(bea, beaSticker.id, 'box', box.id)).status, 404)
    assert.equal((await place(bea, beaSticker.id, 'visit', visit.id)).status, 404)
    assert.equal((await place(bea, alexSticker.id, 'profile', bea)).status, 404)
    assert.equal((await place(bea, beaSticker.id, 'profile', alex)).status, 404)
    assert.equal((await place(alex, alexSticker.id, 'kitchen', box.id)).status, 400)
    assert.equal((await place(alex, alexSticker.id, 'box', box.id, { x: 150 })).status, 400)
    assert.equal((await place(alex, alexSticker.id, 'box', box.id, { scale: 9 })).status, 400)

    const onPrivateReview = await place(alex, alexSticker.id, 'visit', privateVisit.id)
    assert.equal(onPrivateReview.status, 201)
    assert.equal((await image(bea)).status, 404)

    const onProfile = await place(alex, alexSticker.id, 'profile', alex)
    assert.equal(onProfile.status, 201)
    assert.equal((await image(bea)).status, 200)
    assert.equal((await image(bea)).headers.get('content-type'), 'image/png')
    const profile = await request(bea, `/api/profiles/${alex}`)
    assert.equal(profile.data.stickers.length, 1)

    const moved = await request(alex, `/api/stickers/placements/${onProfile.data.placement.id}`, {
      method: 'PATCH',
      body: { x: 75, rotation: -12 },
    })
    assert.equal(moved.data.placement.x, 75)
    assert.equal(moved.data.placement.y, 30)
    assert.equal(moved.data.placement.rotation, -12)
    assert.equal(
      (await request(bea, `/api/stickers/placements/${onProfile.data.placement.id}`, { method: 'PATCH', body: { x: 1 } }))
        .status,
      404,
    )
    assert.equal(
      (await request(alex, `/api/stickers/placements/${onProfile.data.placement.id}`, { method: 'DELETE' })).status,
      200,
    )
    assert.equal((await image(bea)).status, 404)
  })

  await t.test('a dish holds one sticker, from the ticket or added later', async () => {
    const saved = await request(alex, '/api/visits', {
      method: 'POST',
      body: {
        ...ticket,
        isPublic: true,
        place: { name: 'Pixel Diner' },
        dishes: [{ name: 'Burger', price: 200, score: 9, sticker: { stickerId: alexSticker.id, x: 90, y: 10, rotation: 5 } }],
      },
    })
    assert.equal(saved.status, 201)
    const dish = saved.data.visit.dishes[0]
    assert.equal(dish.sticker.stickerId, alexSticker.id)
    assert.equal(dish.sticker.x, 90)
    // On a shared review's dish, the sticker is visible to members
    assert.equal((await request(bea, `/api/stickers/${alexSticker.id}/image`)).status, 200)
    const replaced = await request(alex, '/api/stickers/placements', {
      method: 'POST',
      body: { stickerId: alexSticker.id, target: { type: 'dish', id: dish.id }, x: 10, y: 90 },
    })
    assert.equal(replaced.status, 201)
    const journal = await request(alex, '/api/visits')
    const again = journal.data.visits.find((v) => v.id === saved.data.visit.id).dishes[0]
    assert.equal(again.sticker.id, replaced.data.placement.id)
    // Someone else's sticker on a ticket rolls the whole ticket back
    const before = (await request(alex, '/api/restaurants')).data.restaurants.length
    const foreign = await request(alex, '/api/visits', {
      method: 'POST',
      body: { ...ticket, place: { name: 'Borrowed Sticker Cafe' }, dishes: [{ name: 'Tea', price: 1, sticker: { stickerId: beaSticker.id } }] },
    })
    assert.equal(foreign.status, 400)
    assert.equal((await request(alex, '/api/restaurants')).data.restaurants.length, before)
  })

  await t.test('a card holds up to twelve stickers', async () => {
    for (let n = 0; n < 12; n++) {
      const placed = await request(alex, '/api/stickers/placements', {
        method: 'POST',
        body: { stickerId: alexSticker.id, target: { type: 'box', id: box.id } },
      })
      assert.equal(placed.status, n < 11 ? 201 : 400)
    }
  })

  await t.test('deleting a sticker peels it off every card', async () => {
    assert.equal((await request(bea, `/api/stickers/${alexSticker.id}`, { method: 'DELETE' })).status, 404)
    assert.equal((await request(alex, `/api/stickers/${alexSticker.id}`, { method: 'DELETE' })).status, 200)
    assert.deepEqual((await request(alex, '/api/boxes')).data.boxes[0].stickers, [])
    assert.equal((await request(alex, `/api/stickers/${alexSticker.id}/image`)).status, 404)
  })

  await t.test('likes count once per diner and only on reviews you can see', async () => {
    const route = `/api/reviews/${visit.id}/like`
    for (let n = 0; n < 2; n++) {
      const liked = await request(bea, route, { method: 'PUT' })
      assert.deepEqual([liked.data.likeCount, liked.data.liked], [1, true])
    }
    assert.equal((await request(casey, route, { method: 'PUT' })).data.likeCount, 2)
    const seen = await request(casey, `/api/reviews/${visit.id}`)
    assert.deepEqual([seen.data.review.likeCount, seen.data.review.liked], [2, true])
    assert.equal((await request(bea, route, { method: 'DELETE' })).data.likeCount, 1)
    assert.equal((await request(bea, `/api/reviews/${privateVisit.id}/like`, { method: 'PUT' })).status, 404)
    assert.equal((await request(bea, `/api/reviews/${privateVisit.id}`)).status, 404)
  })

  await t.test('reposts reach the reposter’s followers once, with credit', async () => {
    assert.equal((await request(alex, `/api/reviews/${visit.id}/repost`, { method: 'PUT' })).status, 400)
    assert.equal((await request(bea, `/api/reviews/${privateVisit.id}/repost`, { method: 'PUT' })).status, 404)
    await request(casey, `/api/profiles/${bea}/follow`, { method: 'PUT' })
    assert.equal((await request(casey, '/api/profiles/feed?scope=following')).data.reviews.length, 0)
    const reposted = await request(bea, `/api/reviews/${visit.id}/repost`, { method: 'PUT' })
    assert.deepEqual([reposted.data.repostCount, reposted.data.reposted], [1, true])
    const feed = (await request(casey, '/api/profiles/feed?scope=following')).data.reviews
    assert.equal(feed.length, 1)
    assert.equal(feed[0].id, visit.id)
    assert.equal(feed[0].repostedBy.id, bea)
    assert.equal(feed[0].author.id, alex)
    assert.equal((await request(casey, `/api/profiles/${bea}`)).data.reposts[0].id, visit.id)
    await request(bea, `/api/reviews/${visit.id}/repost`, { method: 'DELETE' })
    assert.equal((await request(casey, '/api/profiles/feed?scope=following')).data.reviews.length, 0)
  })

  await t.test('friends follow each other', async () => {
    await request(alex, `/api/profiles/${bea}/follow`, { method: 'PUT' })
    // Casey followed Bea in the repost check, so Bea can follow both back
    let friends = (await request(bea, '/api/profiles/friends')).data
    assert.deepEqual(friends.followBack.map((p) => p.id), [alex, casey])
    assert.deepEqual(friends.friends, [])
    await request(bea, `/api/profiles/${alex}/follow`, { method: 'PUT' })
    friends = (await request(bea, '/api/profiles/friends')).data
    assert.deepEqual(friends.friends.map((p) => p.id), [alex])
    assert.deepEqual(friends.followBack.map((p) => p.id), [casey])
    assert.equal(friends.friends[0].isFriend, true)
    assert.deepEqual((await request(casey, '/api/profiles/friends')).data.following.map((p) => p.id), [bea])
  })

  await t.test('co-reviews: friends only, accepted by the friend, visible to them', async () => {
    const route = `/api/reviews/${privateVisit.id}/coauthor`
    assert.equal((await request(alex, route, { method: 'PUT', body: { userId: casey } })).status, 400)
    assert.equal((await request(alex, route, { method: 'PUT', body: { userId: alex } })).status, 400)
    assert.equal((await request(bea, route, { method: 'PUT', body: { userId: alex } })).status, 404)
    const invited = await request(alex, route, { method: 'PUT', body: { userId: bea } })
    assert.equal(invited.status, 200)
    assert.deepEqual([invited.data.review.coauthor.id, invited.data.review.coauthor.status], [bea, 'pending'])
    // The invited friend can read the private review to decide
    const invites = (await request(bea, '/api/reviews/invites')).data.invites
    assert.deepEqual(invites.map((review) => review.id), [privateVisit.id])
    assert.equal((await request(bea, `/api/reviews/${privateVisit.id}`)).status, 200)
    assert.equal((await request(casey, `/api/reviews/${privateVisit.id}`)).status, 404)
    assert.equal((await request(casey, `${route}/accept`, { method: 'POST' })).status, 404)

    const accepted = await request(bea, `${route}/accept`, { method: 'POST' })
    assert.equal(accepted.data.review.coauthor.status, 'accepted')
    assert.deepEqual((await request(bea, '/api/reviews/invites')).data.invites, [])
    // Private, so it is on Bea's own profile but not on what Casey sees
    assert.ok((await request(bea, `/api/profiles/${bea}`)).data.reviews.some((r) => r.id === privateVisit.id))
    assert.ok(!(await request(casey, `/api/profiles/${bea}`)).data.reviews.some((r) => r.id === privateVisit.id))
    assert.equal((await request(alex, route, { method: 'PUT', body: { userId: bea } })).status, 409)

    // Shared: Casey follows only Bea and still sees the co-review, credited to both
    await request(alex, `/api/visits/${privateVisit.id}`, { method: 'PATCH', body: { isPublic: true } })
    const feed = (await request(casey, '/api/profiles/feed?scope=following')).data.reviews
    const coReview = feed.find((review) => review.id === privateVisit.id)
    assert.deepEqual([coReview.author.id, coReview.coauthor.id], [alex, bea])
    assert.ok((await request(casey, `/api/profiles/${bea}`)).data.reviews.some((r) => r.id === privateVisit.id))

    // Leaving removes the co-author and their access once the review is private again
    await request(alex, `/api/visits/${privateVisit.id}`, { method: 'PATCH', body: { isPublic: false } })
    assert.equal((await request(bea, route, { method: 'DELETE' })).status, 200)
    assert.equal((await request(bea, `/api/reviews/${privateVisit.id}`)).status, 404)
    assert.equal((await request(bea, route, { method: 'DELETE' })).status, 404)
  })

  await t.test('a ticket can invite a friend, and a non-friend invite saves nothing', async () => {
    const before = (await request(alex, '/api/visits')).data.visits.length
    const refused = await request(alex, '/api/visits', {
      method: 'POST',
      body: { ...ticket, place: { name: 'Table for Three' }, coauthorId: casey },
    })
    assert.equal(refused.status, 400)
    assert.equal((await request(alex, '/api/visits')).data.visits.length, before)
    const together = await request(alex, '/api/visits', {
      method: 'POST',
      body: { ...ticket, place: { name: 'Table for Two' }, coauthorId: bea },
    })
    assert.equal(together.status, 201)
    assert.deepEqual([together.data.visit.coauthor.id, together.data.visit.coauthor.status], [bea, 'pending'])
  })
})
