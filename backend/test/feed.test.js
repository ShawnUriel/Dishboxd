const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createSandbox } = require('./sandbox')

test('the For you feed: people you follow, their reposts and your own reposts', async (t) => {
  const sandbox = await createSandbox()
  t.after(() => sandbox.close())
  const {
    users: [alex, bea, casey],
    request,
  } = sandbox
  for (const user of [alex, bea, casey]) await request(user, '/api/profiles/me')
  const post = async (user, name, isPublic = true) =>
    (await request(user, '/api/visits', {
      method: 'POST',
      body: { place: { name }, date: '2026-10-04', rating: 4, isPublic, dishes: [{ name: 'Tea', price: 1, score: 8 }] },
    })).data.visit
  const feed = async (user, query = '') => (await request(user, `/api/profiles/feed?scope=foryou${query}`)).data.reviews

  // Alex follows Bea only. Casey is a stranger to Alex.
  await request(alex, `/api/profiles/${bea}/follow`, { method: 'PUT' })
  const beaReview = await post(bea, 'Bea’s Noodles')
  const caseyReview = await post(casey, 'Casey’s Bakery')
  const strangerReview = await post(casey, 'Somewhere Else')
  await post(bea, 'Bea’s Secret Spot', false)
  const alexReview = await post(alex, 'Alex’s Own Cafe')

  await t.test('shows reviews by people you follow, but not strangers, private reviews or your own', async () => {
    const ids = (await feed(alex)).map((review) => review.id)
    assert.deepEqual(ids, [beaReview.id])
    assert.ok(!ids.includes(alexReview.id))
  })

  await t.test('your own reposts appear, credited to you, newest activity first', async () => {
    await request(alex, `/api/reviews/${strangerReview.id}/repost`, { method: 'PUT' })
    const reviews = await feed(alex)
    assert.deepEqual(reviews.map((review) => review.id), [strangerReview.id, beaReview.id])
    assert.deepEqual(reviews[0].reposters.map((person) => person.id), [alex])
    assert.equal(reviews[0].reposted, true)
    assert.ok(reviews[0].activityAt)
    // The Following tab still leaves your own reposts out
    const following = (await request(alex, '/api/profiles/feed?scope=following')).data.reviews
    assert.ok(!following.some((review) => review.id === strangerReview.id))
  })

  await t.test('a friend’s repost shows once, with everyone who reposted it', async () => {
    await request(bea, `/api/reviews/${caseyReview.id}/repost`, { method: 'PUT' })
    await request(alex, `/api/reviews/${caseyReview.id}/repost`, { method: 'PUT' })
    const reviews = await feed(alex)
    const shared = reviews.filter((review) => review.id === caseyReview.id)
    assert.equal(shared.length, 1)
    assert.deepEqual(shared[0].reposters.map((person) => person.id), [alex, bea])
    assert.equal(reviews[0].id, caseyReview.id)
    // A friend reposting your own review brings it to your feed too
    await request(bea, `/api/reviews/${alexReview.id}/repost`, { method: 'PUT' })
    const mine = (await feed(alex)).find((review) => review.id === alexReview.id)
    assert.deepEqual(mine.reposters.map((person) => person.id), [bea])
  })

  await t.test('pages continue from the last review shown, and bad cursors are refused', async () => {
    const first = await feed(alex)
    const rest = await feed(alex, `&before=${encodeURIComponent(first[1].activityAt)}`)
    assert.deepEqual(rest.map((review) => review.id), first.slice(2).map((review) => review.id))
    assert.equal((await request(alex, '/api/profiles/feed?scope=foryou&before=yesterday-ish')).status, 400)
  })

  await t.test('un-reposting removes a review that only you brought in', async () => {
    await request(alex, `/api/reviews/${strangerReview.id}/repost`, { method: 'DELETE' })
    assert.ok(!(await feed(alex)).some((review) => review.id === strangerReview.id))
  })
})
