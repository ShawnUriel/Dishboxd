const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createSandbox } = require('./sandbox')

test('bookmarks, review management, conversations and notification preferences', async (t) => {
  const sandbox = await createSandbox()
  t.after(() => sandbox.close())
  const { request, pool, users: [alex, bea, casey] } = sandbox
  for (const user of sandbox.users) await request(user, '/api/profiles/me')
  const ticket = { place: { name: 'Tomorrow Cafe', address: 'Main Street' }, date: '2026-10-07', rating: 5, notes: 'Good soup.', dishes: [{ name: 'Soup', price: 90, score: 8 }, { name: 'Tea', price: 30, score: 7 }], isPublic: true }
  const save = async (user, body = ticket) => {
    const response = await request(user, '/api/visits', { method: 'POST', body })
    assert.equal(response.status, 201)
    return response.data.visit
  }
  let review = await save(alex)
  const privateReview = await save(alex, { ...ticket, isPublic: false })
  const otherReview = await save(bea)
  const commentPath = `/api/reviews/${review.id}/comments`
  const inbox = async (user) => (await request(user, '/api/notifications')).data
  const prefs = { follows: true, reposts: true, comments: true, replies: true, digestFrequency: 'off' }
  let comment, reply

  await t.test('new routes require authentication', async () => {
    for (const [url, method] of [['/api/bookmarks', 'GET'], ['/api/bookmarks', 'POST'], [commentPath, 'GET'], [commentPath, 'POST'], [`/api/visits/${review.id}`, 'PUT'], [`/api/visits/${review.id}`, 'DELETE'], ['/api/notifications/preferences', 'GET'], ['/api/notifications/preferences', 'PATCH']]) {
      assert.equal((await request(null, url, { method })).status, 401)
    }
  })

  await t.test('ticket cuisine is optional, validated, persists per visit and updates passport on edits', async () => {
    const { collectPassport } = await import('../../frontend/src/lib/passport.js')
    const tagged = await save(casey, { ...ticket, cuisine: '  Japanese  ', category: 'Cafe' })
    assert.equal(tagged.cuisine, 'Japanese')
    const untagged = await save(casey, { ...ticket, cuisine: '' })
    assert.equal(untagged.cuisine, '')
    assert.equal(review.cuisine, null)
    const stamps = async () => collectPassport((await request(casey, '/api/visits')).data.visits, (await request(casey, '/api/restaurants')).data.restaurants).filter(stamp => stamp.earned).map(stamp => stamp.name)
    assert.deepEqual(await stamps(), ['Japanese'])
    for (const cuisine of [42, {}, 'x'.repeat(41)]) {
      assert.equal((await request(casey, '/api/visits', { method: 'POST', body: { ...ticket, cuisine } })).status, 400)
    }
    assert.equal((await request(alex, `/api/visits/${tagged.id}`, { method: 'PUT', body: { ...tagged, cuisine: 'Thai' } })).status, 404)
    let changed = await request(casey, `/api/visits/${tagged.id}`, { method: 'PUT', body: { ...tagged, cuisine: 'Korean' } })
    assert.equal(changed.status, 200)
    assert.deepEqual(await stamps(), ['Korean'])
    const { cuisine: omitted, ...olderClient } = changed.data.review
    changed = await request(casey, `/api/visits/${tagged.id}`, { method: 'PUT', body: olderClient })
    assert.equal(changed.data.review.cuisine, 'Korean')
    changed = await request(casey, `/api/visits/${tagged.id}`, { method: 'PUT', body: { ...changed.data.review, cuisine: '' } })
    assert.equal(changed.data.review.cuisine, '')
    assert.deepEqual(await stamps(), [])
    await request(casey, `/api/visits/${tagged.id}`, { method: 'DELETE' })
    await request(casey, `/api/visits/${untagged.id}`, { method: 'DELETE' })
  })

  await t.test('bookmarks are deduplicated, private and do not create visited restaurants', async () => {
    const before = (await request(casey, '/api/restaurants')).data.restaurants.length
    const results = await Promise.all([1, 2, 3].map(() => request(casey, '/api/bookmarks', { method: 'POST', body: { name: '  Nice   Cafe  ', address: ' Main Street ' } })))
    assert.ok(results.every((r) => r.status === 201))
    const bookmark = results[0].data.bookmark
    assert.equal(new Set(results.map((r) => r.data.bookmark.id)).size, 1)
    const normalized = await request(casey, '/api/bookmarks', { method: 'POST', body: { name: 'nice cafe', address: 'main street' } })
    assert.equal(normalized.data.bookmark.id, bookmark.id)
    assert.equal((await request(bea, '/api/bookmarks')).data.bookmarks.length, 0)
    assert.equal((await request(bea, `/api/bookmarks/${bookmark.id}`, { method: 'DELETE' })).status, 404)
    assert.equal((await request(casey, '/api/restaurants')).data.restaurants.length, before)
    assert.equal((await request(casey, `/api/bookmarks/${bookmark.id}`, { method: 'DELETE' })).status, 200)
    assert.equal((await request(casey, '/api/bookmarks')).data.bookmarks.length, 0)
  })

  await t.test('Google bookmarks retain their place id; visible restaurant snapshots can be saved', async () => {
    const body = { name: 'New Spot', placeId: 'google-place', category: 'Cafe' }
    const first = await request(casey, '/api/bookmarks', { method: 'POST', body })
    const again = await request(casey, '/api/bookmarks', { method: 'POST', body: { ...body, name: 'Renamed Spot' } })
    assert.equal(first.data.bookmark.id, again.data.bookmark.id)
    assert.equal(first.data.bookmark.placeId, body.placeId)
    assert.equal((await request(bea, '/api/bookmarks', { method: 'POST', body: { restaurantId: review.restaurantId } })).status, 201)
    const hidden = await save(alex, { ...ticket, place: { name: 'Private-only place' }, isPublic: false })
    assert.equal((await request(bea, '/api/bookmarks', { method: 'POST', body: { restaurantId: hidden.restaurantId } })).status, 404)
    assert.equal((await request(bea, '/api/bookmarks', { method: 'POST', body: { name: '' } })).status, 400)
  })

  await t.test('only the original author can edit; invalid edits leave the full review unchanged', async () => {
    assert.equal((await request(bea, `/api/visits/${review.id}`, { method: 'PUT', body: review })).status, 404)
    const before = (await request(alex, `/api/reviews/${review.id}`)).data.review
    assert.equal((await request(alex, `/api/visits/${review.id}`, { method: 'PUT', body: { ...review, dishes: [] } })).status, 400)
    assert.equal((await request(alex, `/api/visits/${review.id}`, { method: 'PUT', body: { ...review, dishes: otherReview.dishes } })).status, 400)
    assert.deepEqual((await request(alex, `/api/reviews/${review.id}`)).data.review, before)
  })

  await t.test('editing preserves retained dish ids, photos and review stickers; supports reorder/add/remove', async () => {
    const photo = (await pool.query(`INSERT INTO media (user_id, visit_id, kind, data) VALUES ($1,$2,'review',$3) RETURNING id`, [alex, review.id, Buffer.from('test-photo')])).rows[0].id
    const stickerId = (await pool.query(`INSERT INTO stickers (user_id,style,data) VALUES ($1,'original',$2) RETURNING id`, [alex, Buffer.from('test-sticker')])).rows[0].id
    await pool.query('INSERT INTO sticker_placements (user_id,sticker_id,visit_id,x,y) VALUES ($1,$2,$3,20,30)', [alex, stickerId, review.id])
    const stickerBefore = (await request(alex, `/api/reviews/${review.id}`)).data.review.stickers
    await request(bea, `/api/reviews/${review.id}/like`, { method: 'PUT' })
    const saved = await request(alex, `/api/visits/${review.id}`, { method: 'PUT', body: { ...review, notes: 'Updated soup notes.', rating: 4, dishes: [review.dishes[1], { ...review.dishes[0], name: 'Tomato soup' }, { name: 'Cake', price: 70, score: 9 }] } })
    assert.equal(saved.status, 200)
    const next = saved.data.review
    assert.deepEqual(next.dishes.slice(0, 2).map((d) => d.id), [review.dishes[1].id, review.dishes[0].id])
    assert.ok(next.editedAt)
    assert.equal(next.revision, review.revision + 1)
    assert.equal(next.likeCount, 1)
    assert.deepEqual(next.photoIds, [photo])
    assert.deepEqual(next.stickers, stickerBefore)
    assert.equal((await request(alex, `/api/visits/${review.id}`, { method: 'PUT', body: review })).status, 409)
    const removed = await request(alex, `/api/visits/${review.id}`, { method: 'PUT', body: { ...next, dishes: [next.dishes[0]] } })
    assert.equal(removed.status, 200)
    assert.equal(removed.data.review.dishes.length, 1)
    review = removed.data.review
  })

  await t.test('comments and replies preserve parent links and notify the correct recipients once', async () => {
    const added = await request(bea, commentPath, { method: 'POST', body: { body: 'What would you order again?' } })
    assert.equal(added.status, 201)
    comment = added.data.comment
    assert.equal(comment.author.id, bea)
    const responded = await request(alex, commentPath, { method: 'POST', body: { body: 'The soup!', parentId: comment.id } })
    assert.equal(responded.status, 201)
    reply = responded.data.comment
    assert.equal(reply.parentId, comment.id)
    assert.equal(reply.replyToName, 'Bea Santos')
    assert.equal((await inbox(alex)).notifications.filter((n) => n.commentId === comment.id).length, 1)
    assert.equal((await inbox(bea)).notifications.find((n) => n.commentId === reply.id).kind, 'reply')
    assert.equal((await inbox(alex)).notifications.filter((n) => n.commentId === reply.id).length, 0)
    const third = await request(casey, commentPath, { method: 'POST', body: { body: 'Thanks!', parentId: reply.id } })
    assert.equal((await inbox(alex)).notifications.filter((n) => n.commentId === third.data.comment.id).length, 1)
    assert.equal((await request(bea, commentPath)).data.comments.length, 3)
    assert.equal((await request(alex, `/api/reviews/${review.id}`)).data.review.commentCount, 3)
  })

  await t.test('private review visibility covers comments and notification metadata', async () => {
    assert.equal((await request(bea, `/api/reviews/${privateReview.id}/comments`)).status, 404)
    assert.equal((await request(bea, `/api/reviews/${privateReview.id}/comments`, { method: 'POST', body: { body: 'Should not save' } })).status, 404)
    assert.equal((await request(bea, `/api/reviews/${otherReview.id}/comments`, { method: 'POST', body: { body: 'Wrong review', parentId: comment.id } })).status, 400)
    await request(alex, `/api/visits/${review.id}`, { method: 'PATCH', body: { isPublic: false } })
    assert.equal((await request(bea, commentPath)).status, 404)
    assert.equal((await inbox(bea)).notifications.filter((n) => n.commentId === reply.id).length, 0)
    await request(alex, `/api/visits/${review.id}`, { method: 'PATCH', body: { isPublic: true } })
    assert.equal((await request(bea, commentPath)).status, 200)
  })

  await t.test('comment validation, author deletion and owner moderation retain replies', async () => {
    for (const body of ['', 'x'.repeat(1001), 123]) assert.equal((await request(bea, commentPath, { method: 'POST', body: { body } })).status, 400)
    assert.equal((await request(casey, `${commentPath}/${comment.id}`, { method: 'DELETE' })).status, 404)
    assert.equal((await request(bea, `${commentPath}/${comment.id}`, { method: 'DELETE' })).status, 200)
    const data = (await request(alex, commentPath)).data.comments
    assert.equal(data.find((c) => c.id === comment.id).body, '')
    assert.ok(data.find((c) => c.id === comment.id).deleted)
    assert.ok(data.find((c) => c.id === reply.id))
    assert.equal((await request(casey, commentPath, { method: 'POST', body: { body: 'Too late', parentId: comment.id } })).status, 400)
    const caseyComment = data.find((c) => c.author.id === casey)
    assert.equal((await request(alex, `${commentPath}/${caseyComment.id}`, { method: 'DELETE' })).status, 200)
  })

  await t.test('comment pages are bounded and do not duplicate entries', async () => {
    await pool.query(`INSERT INTO review_comments (visit_id,user_id,body) SELECT $1,$2,'Pagination comment' FROM generate_series(1,55)`, [review.id, bea])
    const first = (await request(alex, commentPath)).data
    const next = (await request(alex, `${commentPath}?after=${first.nextCursor}`)).data
    assert.equal(first.comments.length, 50)
    assert.equal(next.comments.length, 8)
    assert.equal(next.nextCursor, null)
    assert.equal(new Set([...first.comments, ...next.comments].map((c) => c.id)).size, 58)
  })

  await t.test('preferences persist, affect new alerts only, and are scoped to the current account', async () => {
    assert.deepEqual((await request(alex, '/api/notifications/preferences')).data.preferences, prefs)
    const updated = await request(alex, '/api/notifications/preferences', { method: 'PATCH', body: { ...prefs, follows: false, reposts: false, comments: false, digestFrequency: 'weekly' } })
    assert.equal(updated.status, 200)
    assert.equal((await request(alex, '/api/notifications/preferences')).data.preferences.digestFrequency, 'weekly')
    assert.deepEqual((await request(bea, '/api/notifications/preferences')).data.preferences, prefs)
    const before = (await inbox(alex)).notifications.length
    await request(casey, `/api/profiles/${alex}/follow`, { method: 'PUT' })
    await request(casey, `/api/reviews/${review.id}/repost`, { method: 'PUT' })
    await request(casey, commentPath, { method: 'POST', body: { body: 'A muted comment' } })
    assert.equal((await inbox(alex)).notifications.length, before)
    assert.equal((await request(alex, '/api/notifications/preferences', { method: 'PATCH', body: { ...prefs, follows: 'false' } })).status, 400)
    assert.equal((await request(alex, '/api/notifications/preferences', { method: 'PATCH', body: { ...prefs, digestFrequency: 'hourly' } })).status, 400)
  })

  await t.test('review deletion is owner-only and cascades activity, discussion and photos, keeping other visits and the restaurant', async () => {
    assert.equal((await request(bea, `/api/visits/${review.id}`, { method: 'DELETE' })).status, 404)
    assert.equal((await request(alex, `/api/visits/${review.id}`, { method: 'DELETE' })).status, 200)
    assert.equal((await request(alex, `/api/reviews/${review.id}`)).status, 404)
    assert.equal((await request(bea, commentPath)).status, 404)
    for (const [table, field] of [['review_comments', 'visit_id'], ['review_reposts', 'visit_id'], ['review_likes', 'visit_id'], ['media', 'visit_id'], ['notifications', 'visit_id'], ['dishes', 'visit_log_id']]) {
      assert.equal((await pool.query(`SELECT count(*)::int AS count FROM ${table} WHERE ${field} = $1`, [review.id])).rows[0].count, 0)
    }
    assert.equal((await request(alex, `/api/reviews/${privateReview.id}`)).status, 200)
    assert.ok((await request(alex, '/api/restaurants')).data.restaurants.some((r) => r.id === review.restaurantId))
  })
})
