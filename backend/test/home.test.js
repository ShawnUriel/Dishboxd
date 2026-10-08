const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createSandbox } = require('./sandbox')

test('private home stickers persist, enforce ownership and survive schema upgrades', async t => {
  const sandbox = await createSandbox()
  t.after(() => sandbox.close())
  const { request, pool, users: [alex, bea] } = sandbox
  const sticker = (await pool.query("INSERT INTO stickers (user_id, style, data) VALUES ($1, 'original', $2) RETURNING id", [alex, Buffer.from('test-png-image')])).rows[0].id
  const other = (await pool.query("INSERT INTO stickers (user_id, style, data) VALUES ($1, 'original', $2) RETURNING id", [bea, Buffer.from('test-png-image')])).rows[0].id
  const place = (user, id = sticker, owner = user) => request(user, '/api/stickers/placements', { method: 'POST', body: { stickerId: id, target: { type: 'home', id: owner }, x: 30, y: 40 } })
  assert.equal((await request(null, '/api/stickers/home')).status, 401)
  assert.equal((await place(bea, sticker)).status, 404)
  assert.equal((await place(alex, sticker, bea)).status, 404)
  assert.equal((await place(alex, other)).status, 404)
  const added = await place(alex)
  assert.equal(added.status, 201)
  const id = added.data.placement.id
  assert.equal((await request(bea, '/api/stickers/home')).data.placements.length, 0)
  assert.equal((await request(bea, `/api/stickers/${sticker}/image`)).status, 404)
  assert.equal((await request(bea, `/api/stickers/placements/${id}`, { method: 'PATCH', body: { x: 50 } })).status, 404)
  assert.equal((await request(bea, `/api/stickers/placements/${id}`, { method: 'DELETE' })).status, 404)
  assert.equal((await request(alex, `/api/stickers/placements/${id}`, { method: 'PATCH', body: { x: 110 } })).status, 400)
  assert.equal((await request(alex, `/api/stickers/placements/${id}`, { method: 'PATCH', body: { x: 70, rotation: 20, scale: 1.5 } })).status, 200)
  const saved = (await request(alex, '/api/stickers/home')).data.placements[0]
  assert.equal(saved.x, 70)
  assert.equal(saved.rotation, 20)
  assert.equal(saved.scale, 1.5)
  // Reapplying the setup must retain existing home decorations.
  await pool.query(sandbox.rewrite(fs.readFileSync(path.join(__dirname, '../database_setup.sql'), 'utf8')))
  assert.deepEqual((await request(alex, '/api/stickers/home')).data.placements, [saved])
  const results = await Promise.all(Array.from({ length: 12 }, () => place(alex)))
  assert.equal(results.filter(result => result.status === 201).length, 11)
  assert.equal(results.filter(result => result.status === 400).length, 1)
  assert.equal((await request(alex, '/api/stickers/home')).data.placements.length, 12)
  await assert.rejects(pool.query('UPDATE sticker_placements SET home_id=$1 WHERE id=$2', [bea, id]), { code: '23514' })
  await request(alex, `/api/stickers/placements/${id}`, { method: 'DELETE' })
  assert.equal((await request(alex, '/api/stickers/home')).data.placements.length, 11)
  await request(alex, `/api/stickers/${sticker}`, { method: 'DELETE' })
  assert.equal((await request(alex, '/api/stickers/home')).data.placements.length, 0)
})

test('passport earns one stamp per reviewed cuisine, handles aliases and updates after removals', async () => {
  const { collectPassport } = await import('../../frontend/src/lib/passport.js')
  const restaurants = [{ id: 'a', category: ' Ramen ' }, { id: 'b', category: 'Japanese' }, { id: 'c', category: 'Cafe' }, { id: 'd', category: 'Italian' }]
  const visits = [{ id: '1', restaurantId: 'a', date: '2026-10-02' }, { id: '2', restaurantId: 'b', date: '2026-10-01' }, { id: '3', restaurantId: 'c', date: '2026-10-03' }]
  const earned = collectPassport(visits, restaurants).filter(stamp => stamp.earned)
  assert.equal(earned.length, 1)
  assert.equal(earned[0].name, 'Japanese')
  assert.equal(earned[0].visits, 2)
  assert.equal(earned[0].firstVisit.id, '2')
  assert.equal(collectPassport([], restaurants).filter(stamp => stamp.earned).length, 0)
  assert.equal(collectPassport([visits[0]], restaurants).find(stamp => stamp.earned).firstVisit.id, '1')
  assert.equal(collectPassport(visits, restaurants.map(place => ({ ...place, category: 'Thai cuisine' }))).find(stamp => stamp.earned).name, 'Thai')
})
