const express = require('express')
const { createHash } = require('node:crypto')
const { pool } = require('../db')
const { text, optionalText, isUuid } = require('../validate')
const { canSeeReview } = require('../social')
const router = express.Router()
const toBookmark = (row) => ({ id: row.id, placeId: row.google_place_id, name: row.name, address: row.address, category: row.category, createdAt: row.created_at })

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM bookmarks WHERE user_id = $1 ORDER BY created_at DESC, id', [req.userId])
  res.json({ bookmarks: rows.map(toBookmark) })
})

router.post('/', async (req, res) => {
  let place = req.body
  if (place?.restaurantId !== undefined) {
    if (!isUuid(place.restaurantId)) return res.status(404).json({ error: 'Restaurant not found.' })
    const { rows } = await pool.query(`SELECT r.name, r.address, r.category, r.google_place_id AS "placeId"
      FROM restaurants r WHERE r.id = $2 AND (r.user_id = $1 OR EXISTS (
        SELECT 1 FROM visit_logs v WHERE v.restaurant_id = r.id AND ${canSeeReview()}))`, [req.userId, place.restaurantId])
    if (!rows.length) return res.status(404).json({ error: 'Restaurant not found.' })
    place = rows[0]
  }
  const name = text(place?.name, 'Restaurant name', { min: 1, max: 100 })
  const address = optionalText(place?.address, 'Address', { max: 120 })
  const category = optionalText(place?.category, 'Category', { max: 40 })
  const placeId = place?.placeId == null ? null : text(place.placeId, 'Place id', { min: 1, max: 300 })
  const normalized = (value) => value.toLowerCase().replace(/\s+/g, ' ').trim()
  const key = createHash('sha256').update(JSON.stringify(placeId ? ['google', placeId] : ['manual', normalized(name), normalized(address)])).digest('hex')
  const { rows } = await pool.query(`INSERT INTO bookmarks (user_id, place_key, google_place_id, name, address, category)
    VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (user_id, place_key) DO UPDATE SET place_key = EXCLUDED.place_key RETURNING *`,
  [req.userId, key, placeId, name, address, category])
  res.status(201).json({ bookmark: toBookmark(rows[0]) })
})

router.delete('/:id', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Bookmark not found.' })
  const { rowCount } = await pool.query('DELETE FROM bookmarks WHERE id = $1 AND user_id = $2', [req.params.id, req.userId])
  if (!rowCount) return res.status(404).json({ error: 'Bookmark not found.' })
  res.json({ ok: true })
})
module.exports = { router }
