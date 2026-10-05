const express = require('express')
const { pool } = require('../db')
const { ValidationError, text, optionalText, isUuid } = require('../validate')
const { placementJson } = require('../social')

const router = express.Router()
const COLORS = ['orange', 'mint', 'lavender', 'pink', 'plum']

function toBox(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    isPublic: row.is_public,
    color: row.color,
    restaurantIds: row.restaurant_ids,
    stickers: row.stickers,
  }
}

// One of the five box colours, or any colour from the colour picker as #rrggbb
function readColor(value) {
  if (typeof value !== 'string') throw new ValidationError('Colour must be text.')
  const color = value.trim().toLowerCase()
  if (!COLORS.includes(color) && !/^#[0-9a-f]{6}$/.test(color)) {
    throw new ValidationError('Choose one of the box colours, or a colour like #ffb366.')
  }
  return color
}

// One box, with the ids of the restaurants filed in it (oldest first) and its stickers
const BOX_QUERY = `
  SELECT b.id, b.title, b.description, b.is_public, b.color,
         COALESCE(
           array_agg(br.restaurant_id ORDER BY br.added_at) FILTER (WHERE br.restaurant_id IS NOT NULL),
           '{}'
         ) AS restaurant_ids,
         COALESCE((SELECT json_agg(${placementJson('sp')} ORDER BY sp.created_at, sp.id)
           FROM sticker_placements sp WHERE sp.box_id = b.id), '[]') AS stickers
  FROM boxes b
  LEFT JOIN box_restaurants br ON br.box_id = b.id
  WHERE b.user_id = $1`

// GET /api/boxes: all of the user's boxes
router.get('/', async (req, res) => {
  const { rows } = await pool.query(`${BOX_QUERY} GROUP BY b.id ORDER BY b.created_at`, [req.userId])
  res.json({ boxes: rows.map(toBox) })
})

// POST /api/boxes: make a new, empty box. Colours rotate through the five box colours.
router.post('/', async (req, res) => {
  const title = text(req.body?.title, 'Box name', { min: 1, max: 60 })
  const { rows } = await pool.query(
    `INSERT INTO boxes (user_id, title, color)
     SELECT $1, $2, ($3::text[])[(COUNT(*) % 5)::int + 1] FROM boxes WHERE user_id = $1
     RETURNING id, title, description, is_public, color, '{}'::uuid[] AS restaurant_ids, '[]'::json AS stickers`,
    [req.userId, title, COLORS],
  )
  res.status(201).json({ box: toBox(rows[0]) })
})

// PATCH /api/boxes/:id { title?, description?, color? }: rename, describe or recolour a box.
// An empty description clears it.
router.patch('/:id', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Box not found.' })
  const body = req.body ?? {}
  const title = body.title === undefined ? null : text(body.title, 'Box name', { min: 1, max: 60 })
  const description =
    body.description === undefined ? null : optionalText(body.description, 'Description', { max: 300 })
  const color = body.color === undefined ? null : readColor(body.color)
  if (title === null && description === null && color === null) {
    throw new ValidationError('Send a new name, description or colour.')
  }
  const { rowCount } = await pool.query(
    `UPDATE boxes SET title = COALESCE($3, title), description = COALESCE($4, description),
       color = COALESCE($5, color)
     WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.userId, title, description, color],
  )
  if (!rowCount) return res.status(404).json({ error: 'Box not found.' })
  const { rows } = await pool.query(`${BOX_QUERY} AND b.id = $2 GROUP BY b.id`, [req.userId, req.params.id])
  res.json({ box: toBox(rows[0]) })
})

// POST /api/boxes/:id/restaurants: file one of the user's restaurants in one of their boxes.
// 201 when it was added, 200 when it was already there (asking twice changes nothing).
router.post('/:id/restaurants', async (req, res) => {
  const boxId = req.params.id
  const restaurantId = req.body?.restaurantId
  if (!isUuid(boxId)) return res.status(404).json({ error: 'Box not found.' })
  if (!isUuid(restaurantId)) throw new ValidationError('restaurantId is not valid.')

  const owned = await pool.query(
    `SELECT
       EXISTS (SELECT 1 FROM boxes WHERE id = $1 AND user_id = $3) AS has_box,
       EXISTS (SELECT 1 FROM restaurants WHERE id = $2 AND user_id = $3) AS has_restaurant`,
    [boxId, restaurantId, req.userId],
  )
  if (!owned.rows[0].has_box) return res.status(404).json({ error: 'Box not found.' })
  if (!owned.rows[0].has_restaurant) return res.status(404).json({ error: 'Restaurant not found.' })

  const inserted = await pool.query(
    `INSERT INTO box_restaurants (box_id, restaurant_id, user_id) VALUES ($1, $2, $3)
     ON CONFLICT (box_id, restaurant_id) DO NOTHING`,
    [boxId, restaurantId, req.userId],
  )
  const { rows } = await pool.query(`${BOX_QUERY} AND b.id = $2 GROUP BY b.id`, [req.userId, boxId])
  res.status(inserted.rowCount === 1 ? 201 : 200).json({ box: toBox(rows[0]) })
})

module.exports = { router }
