const express = require('express')
const { pool, transaction } = require('../db')
const { ValidationError, isUuid } = require('../validate')
const { ensureProfile, reviewColumns, reviewFrom, toReview, loadReview, canSeeReview, areFriends } = require('../social')

const router = express.Router()
const NOT_FOUND = { error: 'Review not found.' }

// Like and repost counts for one review, as the viewer sees them
async function reactions(viewer, id) {
  const { rows } = await pool.query(
    `SELECT (SELECT count(*)::int FROM review_likes WHERE visit_id = $2) AS like_count,
       EXISTS (SELECT 1 FROM review_likes WHERE visit_id = $2 AND user_id = $1) AS liked,
       (SELECT count(*)::int FROM review_reposts WHERE visit_id = $2) AS repost_count,
       EXISTS (SELECT 1 FROM review_reposts WHERE visit_id = $2 AND user_id = $1) AS reposted`,
    [viewer, id],
  )
  const row = rows[0]
  return { likeCount: row.like_count, liked: row.liked, repostCount: row.repost_count, reposted: row.reposted }
}

// The review's id when the viewer may see it, otherwise null (so a private review looks like no review)
async function visibleId(viewer, id) {
  if (!isUuid(id)) return null
  const { rows } = await pool.query(`SELECT v.id FROM visit_logs v WHERE v.id = $2 AND ${canSeeReview()}`, [viewer, id])
  return rows[0]?.id ?? null
}

// GET /api/reviews/invites: reviews a friend asked the user to co-author, waiting for an answer
router.get('/invites', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${reviewColumns} ${reviewFrom}
     JOIN visit_coauthors invite ON invite.visit_id = v.id
     WHERE invite.user_id = $1 AND invite.status = 'pending' AND ${canSeeReview()}
     ORDER BY invite.invited_at DESC LIMIT 50`,
    [req.userId],
  )
  res.json({ invites: rows.map(toReview) })
})

// GET /api/reviews/:id: one review, for the shareable review page
router.get('/:id', async (req, res) => {
  const review = await loadReview(req.userId, req.params.id)
  if (!review) return res.status(404).json(NOT_FOUND)
  res.json({ review })
})

// PUT / DELETE /api/reviews/:id/like: like or unlike a review (asking twice changes nothing)
router.put('/:id/like', async (req, res) => {
  const id = await visibleId(req.userId, req.params.id)
  if (!id) return res.status(404).json(NOT_FOUND)
  await ensureProfile(req.userId)
  await pool.query('INSERT INTO review_likes (visit_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
    id,
    req.userId,
  ])
  res.json(await reactions(req.userId, id))
})

router.delete('/:id/like', async (req, res) => {
  const id = await visibleId(req.userId, req.params.id)
  if (!id) return res.status(404).json(NOT_FOUND)
  await pool.query('DELETE FROM review_likes WHERE visit_id = $1 AND user_id = $2', [id, req.userId])
  res.json(await reactions(req.userId, id))
})

// PUT / DELETE /api/reviews/:id/repost: share someone else's shared review with your followers
router.put('/:id/repost', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json(NOT_FOUND)
  const { rows } = await pool.query(`SELECT v.user_id, v.is_public FROM visit_logs v WHERE v.id = $2 AND ${canSeeReview()}`, [req.userId, req.params.id])
  const visit = rows[0]
  if (!visit || (!visit.is_public && visit.user_id !== req.userId)) return res.status(404).json(NOT_FOUND)
  if (visit.user_id === req.userId) throw new ValidationError('You cannot repost your own review.')
  await ensureProfile(req.userId)
  await pool.query(`WITH added AS (
    INSERT INTO review_reposts (visit_id, user_id) VALUES ($1, $2)
    ON CONFLICT DO NOTHING RETURNING visit_id, user_id
  ) INSERT INTO notifications (recipient_id, actor_id, kind, visit_id)
    SELECT v.user_id, added.user_id, 'repost', added.visit_id
    FROM added JOIN visit_logs v ON v.id = added.visit_id
    WHERE COALESCE((SELECT reposts FROM notification_preferences WHERE user_id = v.user_id), true)`, [
    req.params.id,
    req.userId,
  ])
  res.json(await reactions(req.userId, req.params.id))
})

router.delete('/:id/repost', async (req, res) => {
  const id = await visibleId(req.userId, req.params.id)
  if (!id) return res.status(404).json(NOT_FOUND)
  await pool.query('DELETE FROM review_reposts WHERE visit_id = $1 AND user_id = $2', [id, req.userId])
  res.json(await reactions(req.userId, id))
})

// PUT /api/reviews/:id/coauthor { userId }: the author invites a friend to co-author the review.
// A new invite replaces a pending one; an accepted co-author has to be removed first.
router.put('/:id/coauthor', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json(NOT_FOUND)
  const friend = req.body?.userId
  if (!isUuid(friend)) throw new ValidationError('Choose a friend to invite.')
  if (friend === req.userId) throw new ValidationError('You are already an author of this review.')

  const outcome = await transaction(async (client) => {
    const owned = await client.query('SELECT 1 FROM visit_logs WHERE id = $1 AND user_id = $2 FOR UPDATE', [
      req.params.id,
      req.userId,
    ])
    if (!owned.rows.length) return { status: 404, body: NOT_FOUND }
    if (!(await areFriends(req.userId, friend, client))) {
      throw new ValidationError('You can invite friends only: someone you follow who follows you back.')
    }
    const invited = await client.query(
      `INSERT INTO visit_coauthors (visit_id, user_id) VALUES ($1, $2)
       ON CONFLICT (visit_id) DO UPDATE SET user_id = EXCLUDED.user_id, invited_at = now()
       WHERE visit_coauthors.status = 'pending'`,
      [req.params.id, friend],
    )
    if (!invited.rowCount) {
      return { status: 409, body: { error: 'This review already has a co-author. Remove them to invite someone else.' } }
    }
    return { status: 200, body: { review: await loadReview(req.userId, req.params.id, client) } }
  })
  res.status(outcome.status).json(outcome.body)
})

// POST /api/reviews/:id/coauthor/accept: the invited friend becomes the second author
router.post('/:id/coauthor/accept', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Invite not found.' })
  if (!(await visibleId(req.userId, req.params.id))) return res.status(404).json({ error: 'Invite not found.' })
  const { rowCount } = await pool.query(
    `UPDATE visit_coauthors SET status = 'accepted', accepted_at = now()
     WHERE visit_id = $1 AND user_id = $2 AND status = 'pending'`,
    [req.params.id, req.userId],
  )
  if (!rowCount) return res.status(404).json({ error: 'Invite not found.' })
  res.json({ review: await loadReview(req.userId, req.params.id) })
})

// DELETE /api/reviews/:id/coauthor: the author removes the co-author, or the friend declines or leaves
router.delete('/:id/coauthor', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json(NOT_FOUND)
  const { rowCount } = await pool.query(
    `DELETE FROM visit_coauthors c USING visit_logs v
     WHERE c.visit_id = $1 AND v.id = c.visit_id AND (v.user_id = $2 OR c.user_id = $2)`,
    [req.params.id, req.userId],
  )
  if (!rowCount) return res.status(404).json({ error: 'No co-author to remove.' })
  res.json({ removed: true })
})

module.exports = { router }
