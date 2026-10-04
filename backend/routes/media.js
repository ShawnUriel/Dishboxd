const express = require('express')
const { pool, transaction } = require('../db')
const { ValidationError, isUuid } = require('../validate')
const { ensureProfile } = require('../social')
const { perUserLimit } = require('../rateLimit')
const router = express.Router()
const uploadLimit = perUserLimit({
  limit: 30,
  windowMs: 600000,
  message: 'Too many photo uploads. Try again in a few minutes.',
})
const parseImage = express.raw({ type: 'image/jpeg', limit: 750000 })

function checkImage(body) {
  if (
    !Buffer.isBuffer(body) ||
    body.length < 4 ||
    body[0] !== 0xff ||
    body[1] !== 0xd8 ||
    body.at(-2) !== 0xff ||
    body.at(-1) !== 0xd9
  ) {
    throw new ValidationError('Choose a JPEG, PNG or WebP photo using the photo uploader.')
  }
}

async function storeImage(client, user, kind, body) {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 1))', [user])
  await client.query(
    `DELETE FROM media WHERE user_id = $1 AND kind = 'review' AND visit_id IS NULL AND created_at < now() - interval '1 day'`,
    [user],
  )
  const { rows } = await client.query(
    'SELECT COALESCE(sum(octet_length(data)), 0)::int AS bytes FROM media WHERE user_id = $1',
    [user],
  )
  if (rows[0].bytes + body.length > 30000000)
    throw new ValidationError(
      'Your photo allowance is full (30 MB). Remove some review photos before uploading more.',
    )
  const saved = await client.query(
    'INSERT INTO media (user_id, kind, data) VALUES ($1, $2, $3) RETURNING id',
    [user, kind, body],
  )
  return saved.rows[0].id
}

router.post('/', uploadLimit, parseImage, async (req, res) => {
  checkImage(req.body)
  const id = await transaction((client) => storeImage(client, req.userId, 'review', req.body))
  res.status(201).json({ id })
})

router.put('/avatar', uploadLimit, parseImage, async (req, res) => {
  checkImage(req.body)
  await ensureProfile(req.userId)
  const id = await transaction(async (client) => {
    const photoId = await storeImage(client, req.userId, 'avatar', req.body)
    const current = await client.query('SELECT avatar_id FROM profiles WHERE user_id = $1 FOR UPDATE', [
      req.userId,
    ])
    await client.query('UPDATE profiles SET avatar_id = $2 WHERE user_id = $1', [req.userId, photoId])
    if (current.rows[0].avatar_id)
      await client.query('DELETE FROM media WHERE id = $1 AND user_id = $2', [
        current.rows[0].avatar_id,
        req.userId,
      ])
    return photoId
  })
  res.json({ id })
})

router.get('/:id', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Photo not found.' })
  const { rows } = await pool.query(
    `SELECT m.data FROM media m WHERE m.id = $1 AND (
      m.user_id = $2 OR EXISTS(SELECT 1 FROM profiles WHERE avatar_id = m.id)
      OR EXISTS(SELECT 1 FROM visit_logs WHERE id = m.visit_id AND is_public))`,
    [req.params.id, req.userId],
  )
  if (!rows.length) return res.status(404).json({ error: 'Photo not found.' })
  res
    .set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    })
    .send(rows[0].data)
})

router.delete('/:id', async (req, res) => {
  if (!isUuid(req.params.id)) throw new ValidationError('Photo id is not valid.')
  const { rowCount } = await pool.query(`DELETE FROM media WHERE id = $1 AND user_id = $2`, [
    req.params.id,
    req.userId,
  ])
  if (!rowCount) return res.status(404).json({ error: 'Photo not found.' })
  res.json({ deleted: true })
})

module.exports = { router, checkImage }
