const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createSandbox } = require('./sandbox')

test('follow and repost notifications persist in private, paginated inboxes', async (t) => {
  const sandbox = await createSandbox()
  t.after(() => sandbox.close())
  const { users: [alex, bea, casey], request, pool } = sandbox
  for (const user of sandbox.users) await request(user, '/api/profiles/me')
  const inbox = async (user) => (await request(user, '/api/notifications')).data
  let follow, repost, visit

  await t.test('all inbox endpoints require authentication', async () => {
    for (const [route, method] of [['/api/notifications', 'GET'], ['/api/notifications/read', 'PATCH'], ['/api/notifications/1/read', 'PATCH']]) {
      assert.equal((await request(null, route, { method, ...(method === 'PATCH' ? { body: { through: '1' } } : {}) })).status, 401)
    }
    assert.deepEqual(await inbox(alex), { notifications: [], unreadCount: 0, nextCursor: null })
  })

  await t.test('concurrent repeated follows emit one alert to the followed user only', async () => {
    const responses = await Promise.all(Array.from({ length: 3 }, () => request(bea, `/api/profiles/${alex}/follow`, { method: 'PUT' })))
    assert.ok(responses.every((response) => response.status === 200))
    const data = await inbox(alex)
    assert.equal(data.unreadCount, 1)
    assert.equal(data.notifications.length, 1)
    follow = data.notifications[0]
    assert.equal(follow.actor.id, bea)
    assert.equal(follow.actor.name, 'Bea Santos')
    assert.equal(follow.kind, 'follow')
    assert.equal(follow.readAt, null)
    assert.equal((await inbox(bea)).unreadCount, 0)
    assert.equal((await inbox(casey)).unreadCount, 0)
    assert.equal((await request(alex, `/api/profiles/${alex}/follow`, { method: 'PUT' })).status, 400)
  })

  await t.test('public review reposts notify the author exactly once, private/self reposts do not', async () => {
    const saved = await request(alex, '/api/visits', { method: 'POST', body: {
      place: { name: 'Inbox Cafe' }, date: '2026-10-07', rating: 5, notes: 'A great lunch.',
      dishes: [{ name: 'Soup', price: 150 }], isPublic: true,
    } })
    assert.equal(saved.status, 201)
    visit = saved.data.visit
    const responses = await Promise.all(Array.from({ length: 3 }, () => request(casey, `/api/reviews/${visit.id}/repost`, { method: 'PUT' })))
    assert.ok(responses.every((response) => response.status === 200))
    const data = await inbox(alex)
    assert.equal(data.unreadCount, 2)
    repost = data.notifications[0]
    assert.equal(repost.kind, 'repost')
    assert.equal(repost.reviewId, visit.id)
    assert.equal(repost.restaurantName, 'Inbox Cafe')
    assert.equal(repost.actor.id, casey)
    assert.equal((await request(alex, `/api/reviews/${visit.id}/repost`, { method: 'PUT' })).status, 400)
    await request(alex, `/api/visits/${visit.id}`, { method: 'PATCH', body: { isPublic: false } })
    assert.equal((await request(bea, `/api/reviews/${visit.id}/repost`, { method: 'PUT' })).status, 404)
    assert.equal((await inbox(alex)).notifications.length, 2)
    assert.equal((await inbox(bea)).notifications.length, 0)
    assert.equal((await inbox(casey)).notifications.length, 0)
  })

  await t.test('reading is idempotent and scoped to the recipient', async () => {
    assert.equal((await request(bea, `/api/notifications/${follow.id}/read`, { method: 'PATCH' })).status, 404)
    await request(bea, '/api/notifications/read', { method: 'PATCH', body: { through: repost.id } })
    assert.equal((await inbox(alex)).unreadCount, 2)
    assert.equal((await request(alex, `/api/notifications/${follow.id}/read`, { method: 'PATCH' })).status, 200)
    const firstRead = (await inbox(alex)).notifications.find((item) => item.id === follow.id).readAt
    assert.ok(firstRead)
    await request(alex, `/api/notifications/${follow.id}/read`, { method: 'PATCH' })
    assert.equal((await inbox(alex)).notifications.find((item) => item.id === follow.id).readAt, firstRead)
    assert.equal((await inbox(alex)).unreadCount, 1)
  })

  await t.test('mark-all respects the fetched cutoff, leaving a newer arrival unread', async () => {
    await request(casey, `/api/profiles/${alex}/follow`, { method: 'PUT' })
    assert.equal((await request(alex, '/api/notifications/read', { method: 'PATCH', body: { through: repost.id } })).status, 200)
    const data = await inbox(alex)
    assert.equal(data.unreadCount, 1)
    assert.equal(data.notifications[0].actor.id, casey)
    assert.equal(data.notifications[0].readAt, null)
    assert.ok(data.notifications.find((item) => item.id === repost.id).readAt)
  })

  await t.test('invalid cursors and read ids are rejected', async () => {
    for (const id of ['0', '-1', '1.2', 'x', '9223372036854775808']) {
      assert.equal((await request(alex, `/api/notifications?before=${id}`)).status, 400)
      assert.equal((await request(alex, `/api/notifications/${id}/read`, { method: 'PATCH' })).status, 400)
      assert.equal((await request(alex, '/api/notifications/read', { method: 'PATCH', body: { through: id } })).status, 400)
    }
    assert.equal((await request(alex, '/api/notifications/read', { method: 'PATCH', body: {} })).status, 400)
  })

  await t.test('older pages do not overlap and unread count covers the entire inbox', async () => {
    await pool.query(`INSERT INTO notifications (recipient_id, actor_id, kind)
      SELECT $1, $2, 'follow' FROM generate_series(1, 35)`, [alex, bea])
    const first = await inbox(alex)
    const second = (await request(alex, `/api/notifications?before=${first.nextCursor}`)).data
    assert.equal(first.notifications.length, 30)
    assert.equal(second.notifications.length, 8)
    assert.equal(second.nextCursor, null)
    assert.equal(first.unreadCount, 36)
    assert.equal(second.unreadCount, 36)
    assert.equal(new Set([...first.notifications, ...second.notifications].map((item) => item.id)).size, 38)
  })

  await t.test('rerunning the additive migration preserves events and read state', async () => {
    const before = await inbox(alex)
    await pool.query(sandbox.rewrite(fs.readFileSync(path.join(__dirname, '../database_setup.sql'), 'utf8')))
    assert.deepEqual(await inbox(alex), before)
  })

  await t.test('unfollowing keeps history and a genuinely new follow emits a new alert', async () => {
    const before = (await inbox(alex)).unreadCount
    await request(bea, `/api/profiles/${alex}/follow`, { method: 'DELETE' })
    assert.equal((await inbox(alex)).unreadCount, before)
    await request(bea, `/api/profiles/${alex}/follow`, { method: 'PUT' })
    assert.equal((await inbox(alex)).unreadCount, before + 1)
  })
})
