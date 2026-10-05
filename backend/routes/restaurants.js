const express = require('express')
const { pool } = require('../db')
const { text, isUuid } = require('../validate')

const router = express.Router()

// Shape a database row the way the React app expects it
function toRestaurant(row) {
  return {
    id: row.id,
    number: row.number,
    placeId: row.google_place_id,
    name: row.name,
    address: row.address,
    category: row.category ?? '',
  }
}

// A category is short free text ("Cafe", "Matcha bar", "Italian"). The app suggests common ones.
// Empty means "not sorted yet".
function readCategory(value) {
  if (value === undefined || value === null) return ''
  return text(value, 'Category', { max: 40 }).replace(/\s+/g, ' ')
}

// GET /api/restaurants: every restaurant the logged-in user has filed
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, number, google_place_id, name, address, category
     FROM restaurants WHERE user_id = $1 ORDER BY number`,
    [req.userId],
  )
  res.json({ restaurants: rows.map(toRestaurant) })
})

// PATCH /api/restaurants/:id { category }: sort one of the user's restaurants into a category
router.patch('/:id', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Restaurant not found.' })
  const category = readCategory(req.body?.category)
  const { rows } = await pool.query(
    `UPDATE restaurants SET category = $3 WHERE id = $1 AND user_id = $2
     RETURNING id, number, google_place_id, name, address, category`,
    [req.params.id, req.userId, category],
  )
  if (!rows.length) return res.status(404).json({ error: 'Restaurant not found.' })
  res.json({ restaurant: toRestaurant(rows[0]) })
})

module.exports = { router, toRestaurant, readCategory }
