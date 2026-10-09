const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createSandbox } = require('./sandbox')

test('co-review invitations notify once and track the pending invitation lifecycle', async (t) => {
  const sandbox = await createSandbox()
  t.after(() => sandbox.close())
  const { users: [alex, bea, casey], request, pool } = sandbox
  for (const user of sandbox.users) await request(user, '/api/profiles/me')
  for (const friend of [bea, casey]) {
    await request(alex, `/api/profiles/${friend}/follow`, { method: 'PUT' })
    await request(friend, `/api/profiles/${alex}/follow`, { method: 'PUT' })
  }
  const invitations = async (user) => (await request(user, '/api/notifications')).data.notifications.filter((item) => item.kind === 'coauthor_invite')
  const pending = async (user) => (await request(user, '/api/reviews/invites')).data.invites
  const saved = await request(alex, '/api/visits', { method: 'POST', body: {
    place: { name: 'Invitation Cafe' }, date: '2026-10-09', rating: 5,
    dishes: [{ name: 'Coffee', price: 100 }], coauthorId: bea, isPublic: false,
  } })
  assert.equal(saved.status, 201)
  const id = saved.data.visit.id
  const route = `/api/reviews/${id}/coauthor`
  const [invite] = await invitations(bea)
  assert.equal(invite.actor.id, alex)
  assert.equal(invite.reviewId, id)
  assert.equal(invite.restaurantName, 'Invitation Cafe')
  assert.equal(invite.readAt, null)
  assert.equal((await pending(bea))[0].id, id)
  assert.deepEqual(await invitations(casey), [])
  await request(bea, `/api/notifications/${invite.id}/read`, { method: 'PATCH' })
  // Concurrent retrying the invitation does not create new alerts or reset read state.
  await Promise.all([1, 2, 3].map(() => request(alex, route, { method: 'PUT', body: { userId: bea } })))
  assert.equal((await invitations(bea)).length, 1)
  assert.equal((await invitations(bea))[0].id, invite.id)
  assert.ok((await invitations(bea))[0].readAt)
  const before = await invitations(bea)
  await pool.query(sandbox.rewrite(fs.readFileSync(path.join(__dirname, '../database_setup.sql'), 'utf8')))
  assert.deepEqual(await invitations(bea), before)
  // Replacement removes the old invite and alerts the new recipient.
  assert.equal((await request(alex, route, { method: 'PUT', body: { userId: casey } })).status, 200)
  assert.deepEqual(await invitations(bea), [])
  assert.deepEqual(await pending(bea), [])
  assert.equal((await invitations(casey)).length, 1)
  assert.equal((await pending(casey)).length, 1)
  assert.equal((await request(casey, `${route}/accept`, { method: 'POST' })).status, 200)
  assert.deepEqual(await invitations(casey), [])
  assert.deepEqual(await pending(casey), [])
  assert.equal((await request(alex, route, { method: 'PUT', body: { userId: bea } })).status, 409)
  assert.deepEqual(await invitations(bea), [])
  await request(alex, route, { method: 'DELETE' })
  await request(alex, route, { method: 'PUT', body: { userId: bea } })
  assert.equal((await invitations(bea)).length, 1)
  await request(bea, route, { method: 'DELETE' })
  assert.deepEqual(await invitations(bea), [])
  assert.deepEqual(await pending(bea), [])
  await request(alex, route, { method: 'PUT', body: { userId: bea } })
  // The migration restores pre-existing pending invitations without duplicates.
  await pool.query("DELETE FROM notifications WHERE kind = 'coauthor_invite'")
  await pool.query(sandbox.rewrite(fs.readFileSync(path.join(__dirname, '../database_setup.sql'), 'utf8')))
  assert.equal((await invitations(bea)).length, 1)
  await request(alex, route, { method: 'DELETE' })
  assert.deepEqual(await invitations(bea), [])
  assert.deepEqual(await pending(bea), [])
})

