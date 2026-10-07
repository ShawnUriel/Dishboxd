const express = require('express')
const { pool } = require('../db')
const { ValidationError } = require('../validate')
const { ensureProfile, canSeeReview } = require('../social')

const router = express.Router()
const visible = `(n.kind IN ('follow', 'repost') OR EXISTS (
  SELECT 1 FROM visit_logs v WHERE v.id = n.visit_id AND ${canSeeReview()}))`

router.get('/preferences', async (req, res) => {
  await ensureProfile(req.userId)
  const { rows } = await pool.query(`INSERT INTO notification_preferences (user_id) VALUES ($1)
    ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id RETURNING follows, reposts, comments, replies, digest_frequency AS "digestFrequency"`, [req.userId])
  res.json({ preferences: rows[0] })
})

router.patch('/preferences', async (req, res) => {
  const { follows, reposts, comments, replies, digestFrequency } = req.body ?? {}
  if ([follows, reposts, comments, replies].some((value) => typeof value !== 'boolean') || !['off', 'daily', 'weekly'].includes(digestFrequency)) {
    throw new ValidationError('Choose notification types and a valid digest frequency.')
  }
  await ensureProfile(req.userId)
  const { rows } = await pool.query(`INSERT INTO notification_preferences (user_id, follows, reposts, comments, replies, digest_frequency)
    VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (user_id) DO UPDATE SET follows=$2, reposts=$3, comments=$4, replies=$5,
    digest_since = CASE WHEN notification_preferences.digest_frequency <> $6 THEN now() ELSE notification_preferences.digest_since END,
    digest_frequency=$6 RETURNING follows, reposts, comments, replies, digest_frequency AS "digestFrequency"`, [req.userId, follows, reposts, comments, replies, digestFrequency])
  res.json({ preferences: rows[0] })
})

// Keep bigint ids as strings, including cursors, to avoid losing precision in JS.
function notificationId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,18}$/.test(value) || BigInt(value) > 9223372036854775807n) {
    throw new ValidationError('Invalid notification id.')
  }
  return value
}

router.get('/', async (req, res) => {
  const before = req.query.before === undefined ? null : notificationId(req.query.before)
  const [items, count] = await Promise.all([
    pool.query(`SELECT n.*, p.display_name, p.handle, p.avatar_id, r.name AS restaurant_name
      FROM notifications n JOIN profiles p ON p.user_id = n.actor_id
      LEFT JOIN visit_logs v ON v.id = n.visit_id
      LEFT JOIN restaurants r ON r.id = v.restaurant_id
      WHERE n.recipient_id = $1 AND ${visible} AND ($2::bigint IS NULL OR n.id < $2)
      ORDER BY n.id DESC LIMIT 31`, [req.userId, before]),
    pool.query(`SELECT count(*)::int AS unread FROM notifications n WHERE recipient_id = $1 AND read_at IS NULL AND ${visible}`, [req.userId]),
  ])
  const notifications = items.rows.slice(0, 30).map((row) => ({
    id: row.id,
    kind: row.kind,
    createdAt: row.created_at,
    readAt: row.read_at,
    actor: { id: row.actor_id, name: row.display_name, handle: row.handle, avatarId: row.avatar_id },
    reviewId: row.visit_id,
    commentId: row.comment_id,
    restaurantName: row.restaurant_name,
  }))
  res.json({ notifications, unreadCount: count.rows[0].unread, nextCursor: items.rows.length > 30 ? notifications.at(-1).id : null })
})

// Only acknowledge events already fetched by the client; newer arrivals stay unread.
router.patch('/read', async (req, res) => {
  const through = notificationId(req.body?.through)
  await pool.query(`UPDATE notifications SET read_at = now()
    WHERE recipient_id = $1 AND id <= $2 AND read_at IS NULL`, [req.userId, through])
  res.json({ ok: true })
})

router.patch('/:id/read', async (req, res) => {
  const id = notificationId(req.params.id)
  const { rowCount } = await pool.query(`UPDATE notifications SET read_at = COALESCE(read_at, now())
    WHERE id = $1 AND recipient_id = $2`, [id, req.userId])
  if (!rowCount) return res.status(404).json({ error: 'Notification not found.' })
  res.json({ ok: true })
})

module.exports = { router }
