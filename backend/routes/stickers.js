const express = require('express')
const { pool, transaction } = require('../db')
const { ValidationError, number, isUuid } = require('../validate')
const { ensureProfile, toPlacement } = require('../social')
const { perUserLimit } = require('../rateLimit')

const router = express.Router()
const STYLES = ['original', 'pixel', 'vector', 'translucent']
const MAX_STICKERS = 60
const MAX_PER_CARD = 12
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
// Stickers are made in the browser (cut out, pixelated...) and arrive as small PNGs
const parsePng = express.raw({ type: 'image/png', limit: 400000 })
const uploadLimit = perUserLimit({
  limit: 30,
  windowMs: 600000,
  message: 'Too many stickers made at once. Try again in a few minutes.',
})

// Where a sticker can go, and the check that the card belongs to the signed-in user ($1).
// $3 is the card's id; $2 (the sticker) is checked separately in the same query.
const TARGETS = {
  profile: { column: 'profile_id', owned: 'SELECT 1 FROM profiles WHERE user_id = $3 AND user_id = $1' },
  visit: { column: 'visit_id', owned: 'SELECT 1 FROM visit_logs WHERE id = $3 AND user_id = $1' },
  box: { column: 'box_id', owned: 'SELECT 1 FROM boxes WHERE id = $3 AND user_id = $1' },
  dish: {
    column: 'dish_id',
    owned: 'SELECT 1 FROM dishes d JOIN visit_logs dv ON dv.id = d.visit_log_id WHERE d.id = $3 AND dv.user_id = $1',
  },
}

// Position as a percentage of the card, tilt in degrees and size as a multiple.
// With `partial`, missing fields stay null so an update keeps their current value.
function readPosition(body, field = 'Sticker', partial = false) {
  const read = (key, fallback, label, min, max) => {
    const value = body?.[key]
    if (value === undefined || value === null) return partial ? null : fallback
    return number(value, `${field} ${label}`, { min, max })
  }
  const rotation = read('rotation', 0, 'tilt', -45, 45)
  return {
    x: read('x', 50, 'position', 0, 100),
    y: read('y', 50, 'position', 0, 100),
    rotation: rotation === null ? null : Math.round(rotation),
    scale: read('scale', 1, 'size', 0.5, 2),
  }
}

function readPlacement(body, field = 'Sticker') {
  if (!body || typeof body !== 'object' || !isUuid(body.stickerId)) {
    throw new ValidationError(`${field} is not valid. Choose it again.`)
  }
  return { stickerId: body.stickerId, ...readPosition(body, field) }
}

function toSticker(row) {
  return { id: row.id, style: row.style, createdAt: row.created_at, uses: row.uses }
}

// GET /api/stickers: the user's sticker book, newest first
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.id, s.style, s.created_at,
       (SELECT count(*)::int FROM sticker_placements sp WHERE sp.sticker_id = s.id) AS uses
     FROM stickers s WHERE s.user_id = $1 ORDER BY s.created_at DESC`,
    [req.userId],
  )
  res.json({ stickers: rows.map(toSticker) })
})

// POST /api/stickers?style=pixel with a PNG body: add a sticker to the user's book
router.post('/', uploadLimit, parsePng, async (req, res) => {
  const style = req.query.style
  if (!STYLES.includes(style)) throw new ValidationError('Choose a sticker style.')
  const body = req.body
  if (!Buffer.isBuffer(body) || body.length < 8 || !body.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new ValidationError('Make your sticker with the sticker maker.')
  }
  const sticker = await transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 2))', [req.userId])
    const { rows } = await client.query('SELECT count(*)::int AS count FROM stickers WHERE user_id = $1', [
      req.userId,
    ])
    if (rows[0].count >= MAX_STICKERS) {
      throw new ValidationError(`Your sticker book is full (${MAX_STICKERS}). Delete one to make room.`)
    }
    const saved = await client.query(
      `INSERT INTO stickers (user_id, style, data) VALUES ($1, $2, $3) RETURNING id, style, created_at, 0 AS uses`,
      [req.userId, style, body],
    )
    return saved.rows[0]
  })
  res.status(201).json({ sticker: toSticker(sticker) })
})

// GET /api/stickers/:id/image: the PNG, for its owner, or for anyone who can see a card it is stuck on.
// Profiles are visible to every member; reviews and their dishes follow the review's sharing.
// Boxes are private, so a sticker used only on boxes stays with its owner.
router.get('/:id/image', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Sticker not found.' })
  const { rows } = await pool.query(
    `SELECT s.data FROM stickers s WHERE s.id = $1 AND (s.user_id = $2 OR EXISTS (
       SELECT 1 FROM sticker_placements sp
       LEFT JOIN dishes d ON d.id = sp.dish_id
       LEFT JOIN visit_logs v ON v.id = COALESCE(sp.visit_id, d.visit_log_id)
       WHERE sp.sticker_id = s.id AND (sp.profile_id IS NOT NULL OR (v.id IS NOT NULL AND (v.is_public
         OR EXISTS (SELECT 1 FROM visit_coauthors c WHERE c.visit_id = v.id AND c.user_id = $2))))))`,
    [req.params.id, req.userId],
  )
  if (!rows.length) return res.status(404).json({ error: 'Sticker not found.' })
  res
    .set({ 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' })
    .send(rows[0].data)
})

// DELETE /api/stickers/:id: removes it from the book and peels it off every card
router.delete('/:id', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Sticker not found.' })
  const { rowCount } = await pool.query('DELETE FROM stickers WHERE id = $1 AND user_id = $2', [
    req.params.id,
    req.userId,
  ])
  if (!rowCount) return res.status(404).json({ error: 'Sticker not found.' })
  res.json({ deleted: true })
})

// POST /api/stickers/placements { stickerId, target: { type, id }, x, y, rotation, scale }
// Sticks one of the user's stickers on one of their own cards. A dish holds one sticker,
// so a new one replaces the old; other cards hold up to twelve.
router.post('/placements', async (req, res) => {
  const placement = readPlacement(req.body)
  const type = req.body?.target?.type
  const targetId = req.body?.target?.id
  const target = Object.hasOwn(TARGETS, type) ? TARGETS[type] : null
  if (!target || !isUuid(targetId)) throw new ValidationError('Choose where to stick it.')
  if (type === 'profile') await ensureProfile(req.userId)

  const saved = await transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 3))', [req.userId])
    const { rows } = await client.query(
      `SELECT EXISTS (${target.owned}) AS has_target,
         EXISTS (SELECT 1 FROM stickers WHERE id = $2 AND user_id = $1) AS has_sticker`,
      [req.userId, placement.stickerId, targetId],
    )
    if (!rows[0].has_target) return { status: 404, error: 'That card was not found.' }
    if (!rows[0].has_sticker) return { status: 404, error: 'Sticker not found.' }
    if (type === 'dish') {
      await client.query('DELETE FROM sticker_placements WHERE dish_id = $1 AND user_id = $2', [targetId, req.userId])
    }
    const count = await client.query(
      `SELECT count(*)::int AS count FROM sticker_placements WHERE ${target.column} = $1`,
      [targetId],
    )
    if (count.rows[0].count >= MAX_PER_CARD) {
      throw new ValidationError(`A card can hold up to ${MAX_PER_CARD} stickers.`)
    }
    const inserted = await client.query(
      `INSERT INTO sticker_placements (user_id, sticker_id, ${target.column}, x, y, rotation, scale)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, sticker_id, x, y, rotation, scale`,
      [req.userId, placement.stickerId, targetId, placement.x, placement.y, placement.rotation, placement.scale],
    )
    return { placement: toPlacement(inserted.rows[0]) }
  })
  if (saved.error) return res.status(saved.status).json({ error: saved.error })
  res.status(201).json({ placement: saved.placement })
})

// PATCH /api/stickers/placements/:id { x?, y?, rotation?, scale? }: move, tilt or resize a sticker
router.patch('/placements/:id', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Sticker not found.' })
  const position = readPosition(req.body, 'Sticker', true)
  const { rows } = await pool.query(
    `UPDATE sticker_placements SET x = COALESCE($3, x), y = COALESCE($4, y),
       rotation = COALESCE($5, rotation), scale = COALESCE($6, scale)
     WHERE id = $1 AND user_id = $2 RETURNING id, sticker_id, x, y, rotation, scale`,
    [req.params.id, req.userId, position.x, position.y, position.rotation, position.scale],
  )
  if (!rows.length) return res.status(404).json({ error: 'Sticker not found.' })
  res.json({ placement: toPlacement(rows[0]) })
})

// DELETE /api/stickers/placements/:id: peel a sticker off its card (it stays in the book)
router.delete('/placements/:id', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Sticker not found.' })
  const { rowCount } = await pool.query('DELETE FROM sticker_placements WHERE id = $1 AND user_id = $2', [
    req.params.id,
    req.userId,
  ])
  if (!rowCount) return res.status(404).json({ error: 'Sticker not found.' })
  res.json({ deleted: true })
})

module.exports = { router, readPlacement }
