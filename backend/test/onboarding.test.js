const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createSandbox } = require('./sandbox')

test('onboarding: username rules, tour state and the one-time migration', async (t) => {
  const sandbox = await createSandbox()
  t.after(() => sandbox.close())
  const {
    users: [alex, bea, casey],
    request,
    pool,
    rewrite,
  } = sandbox
  const pick = (user, handle) => request(user, '/api/profiles/me/username', { method: 'PUT', body: { handle } })

  await t.test('a new account starts with an automatic handle and both steps to do', async () => {
    const { data } = await request(alex, '/api/profiles/me')
    assert.match(data.profile.handle, /^diner_[0-9a-f]{24}$/)
    assert.deepEqual(data.onboarding, { needsUsername: true, needsTour: true })
    assert.equal((await request(alex, '/api/profiles/me/tour', { method: 'PUT' })).status, 400)
  })

  await t.test('usernames follow the 3 to 10 character rule', async () => {
    for (const handle of ['ab', 'abcdefghijk', 'bea eats', 'bea@eats', 'bea/eats', 'bea!', 'bea?', 'bea*', 'bea#', 'bea$', 'bea&', '...', '', 42]) {
      const response = await pick(alex, handle)
      assert.equal(response.status, 400, `${JSON.stringify(handle)} should be refused`)
      assert.match(response.data.error, /^Username/)
    }
    const saved = await pick(alex, '  Alex.Eats ')
    assert.equal(saved.status, 200)
    assert.equal(saved.data.profile.handle, 'alex.eats')
    assert.deepEqual(saved.data.onboarding, { needsUsername: false, needsTour: true })
    const specials = await pick(bea, 'b_-.123456')
    assert.equal(specials.status, 200)
    assert.equal(specials.data.profile.handle, 'b_-.123456')
  })

  await t.test('usernames are unique regardless of capitals', async () => {
    const response = await pick(casey, 'ALEX.EATS')
    assert.equal(response.status, 409)
    assert.equal(response.data.error, 'That username is already taken. Try another one.')
  })

  await t.test('finishing or skipping the tour is remembered', async () => {
    for (let n = 0; n < 2; n++) {
      const response = await request(alex, '/api/profiles/me/tour', { method: 'PUT' })
      assert.equal(response.status, 200)
      assert.deepEqual(response.data.onboarding, { needsUsername: false, needsTour: false })
    }
  })

  await t.test('profile edits keep an older long username but check a new one', async () => {
    await pool.query(`UPDATE profiles SET handle = 'bea_at_the_table' WHERE user_id = $1`, [bea])
    const edit = (handle) =>
      request(bea, '/api/profiles/me', { method: 'PATCH', body: { name: 'Bea', handle, bio: 'Noodles.' } })
    const kept = await edit('bea_at_the_table')
    assert.equal(kept.status, 200)
    assert.equal(kept.data.profile.bio, 'Noodles.')
    assert.equal((await edit('bea_at_lunch')).status, 400)
    assert.equal((await edit('bea.eats')).data.profile.handle, 'bea.eats')
  })

  await t.test('saving a profile with the automatic handle does not count as picking one', async () => {
    const { data } = await request(casey, '/api/profiles/me')
    const edit = (handle) =>
      request(casey, '/api/profiles/me', { method: 'PATCH', body: { name: 'Casey', handle, bio: '' } })
    assert.equal((await edit(data.profile.handle)).data.onboarding.needsUsername, true)
    assert.equal((await edit('casey')).data.onboarding.needsUsername, false)
  })

  await t.test('the migration skips the tour for existing diners and asks automatic handles only', async () => {
    const setup = () => pool.query(rewrite(fs.readFileSync(path.join(__dirname, '../database_setup.sql'), 'utf8')))
    await pool.query(`UPDATE profiles SET handle = 'diner_' || left(replace(user_id::text, '-', ''), 24) WHERE user_id = $1`, [casey])
    await pool.query('ALTER TABLE profiles DROP COLUMN handle_set_at, DROP COLUMN tour_done_at')
    await setup()
    const state = async (user) => (await request(user, '/api/profiles/me')).data.onboarding
    assert.deepEqual(await state(alex), { needsUsername: false, needsTour: false })
    assert.deepEqual(await state(casey), { needsUsername: true, needsTour: false })
    // Running setup again (every upgrade does) must not mark anyone's onboarding as done
    await pool.query('UPDATE profiles SET tour_done_at = NULL WHERE user_id = $1', [bea])
    await setup()
    assert.equal((await state(bea)).needsTour, true)
  })
})
