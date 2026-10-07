const express = require('express')
const { pool, transaction } = require('../db')
const { ensureProfile, canSeeReview } = require('../social')
const { text, isUuid, ValidationError } = require('../validate')
const { perUserLimit } = require('../rateLimit')
const router = express.Router({ mergeParams: true })
const validId = (value) => typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n
const missing = { error: 'Review or comment not found.' }

router.use((req, res, next) => isUuid(req.params.id) ? next() : res.status(404).json(missing))

router.get('/', async (req, res) => {
  const after = req.query.after ?? '0'
  if (after !== '0' && !validId(after)) throw new ValidationError('Invalid comment cursor.')
  const visible = await pool.query(`SELECT 1 FROM visit_logs v WHERE v.id = $2 AND ${canSeeReview()}`, [req.userId, req.params.id])
  if (!visible.rowCount) return res.status(404).json(missing)
  const { rows } = await pool.query(`SELECT c.*, p.display_name, p.handle, p.avatar_id,
      parent_profile.display_name AS reply_to_name
    FROM review_comments c JOIN profiles p ON p.user_id = c.user_id
    LEFT JOIN review_comments parent ON parent.id = c.parent_id
    LEFT JOIN profiles parent_profile ON parent_profile.user_id = parent.user_id
    WHERE c.visit_id = $1 AND c.id > $2 ORDER BY c.id LIMIT 51`, [req.params.id, after])
  const comments = rows.slice(0, 50).map((row) => ({
    id: row.id, parentId: row.parent_id, body: row.deleted_at ? '' : row.body, deleted: Boolean(row.deleted_at),
    createdAt: row.created_at, replyToName: row.reply_to_name,
    author: { id: row.user_id, name: row.display_name, handle: row.handle, avatarId: row.avatar_id },
  }))
  res.json({ comments, nextCursor: rows.length > 50 ? comments.at(-1).id : null })
})

router.post('/', perUserLimit({ limit: 20, windowMs: 60000, message: 'Give the conversation a moment. Try again shortly.' }), async (req, res) => {
  const body = text(req.body?.body, 'Comment', { min: 1, max: 1000 })
  const parentId = req.body?.parentId ?? null
  if (parentId !== null && !validId(parentId)) throw new ValidationError('Choose a valid comment to reply to.')
  await ensureProfile(req.userId)
  const result = await transaction(async (client) => {
    // Serializes comments with visibility changes and review deletion.
    const review = await client.query(`SELECT v.user_id FROM visit_logs v WHERE v.id = $2 AND ${canSeeReview()} FOR UPDATE`, [req.userId, req.params.id])
    if (!review.rowCount) return null
    let parent
    if (parentId) {
      parent = (await client.query('SELECT * FROM review_comments WHERE id = $1 AND visit_id = $2 AND deleted_at IS NULL FOR UPDATE', [parentId, req.params.id])).rows[0]
      if (!parent) throw new ValidationError('That comment is no longer available to reply to.')
    }
    const { rows } = await client.query('INSERT INTO review_comments (visit_id, user_id, parent_id, body) VALUES ($1, $2, $3, $4) RETURNING id', [req.params.id, req.userId, parentId, body])
    const recipients = new Map([[review.rows[0].user_id, 'comment']])
    if (parent) recipients.set(parent.user_id, 'reply')
    for (const [recipient, kind] of recipients) {
      if (recipient === req.userId) continue
      await client.query(`INSERT INTO notifications (recipient_id, actor_id, kind, visit_id, comment_id)
        SELECT $1, $2, $3, $4, $5 WHERE COALESCE((SELECT CASE WHEN $3 = 'reply' THEN replies ELSE comments END
          FROM notification_preferences WHERE user_id = $1), true)`, [recipient, req.userId, kind, req.params.id, rows[0].id])
    }
    const author = (await client.query('SELECT display_name, handle, avatar_id FROM profiles WHERE user_id = $1', [req.userId])).rows[0]
    const created = (await client.query('SELECT created_at FROM review_comments WHERE id = $1', [rows[0].id])).rows[0]
    const replyName = parent ? (await client.query('SELECT display_name FROM profiles WHERE user_id = $1', [parent.user_id])).rows[0]?.display_name : null
    return { comment: { id: rows[0].id, parentId, body, deleted: false, createdAt: created.created_at, replyToName: replyName,
      author: { id: req.userId, name: author.display_name, handle: author.handle, avatarId: author.avatar_id } } }
  })
  if (!result) return res.status(404).json(missing)
  res.status(201).json(result)
})

// Leave a tombstone so replies retain their context. Authors can remove their own text;
// the review owner can moderate any comment on their review.
router.delete('/:commentId', async (req, res) => {
  if (!validId(req.params.commentId)) return res.status(404).json(missing)
  const removed = await transaction(async (client) => {
    const review = await client.query(`SELECT v.user_id FROM visit_logs v WHERE v.id = $2 AND ${canSeeReview()} FOR UPDATE`, [req.userId, req.params.id])
    if (!review.rowCount) return false
    const { rowCount } = await client.query(`UPDATE review_comments SET body = '', deleted_at = COALESCE(deleted_at, now())
      WHERE id = $1 AND visit_id = $2 AND (user_id = $3 OR $4 = $3)`, [req.params.commentId, req.params.id, req.userId, review.rows[0].user_id])
    if (rowCount) await client.query('DELETE FROM notifications WHERE comment_id = $1', [req.params.commentId])
    return Boolean(rowCount)
  })
  if (!removed) return res.status(404).json(missing)
  res.json({ ok: true })
})
module.exports = { router }
