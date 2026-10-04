const express = require('express')
const { pool } = require('../db')

const router = express.Router()

// Shape a database row the way the React app expects it
function toRestaurant(row) {
  return {
    id: row.id,
    number: row.number,
    placeId: row.google_place_id,
    name: row.name,
    address: row.address,
  }
}

// GET /api/restaurants: every restaurant the logged-in user has filed
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, number, google_place_id, name, address
     FROM restaurants WHERE user_id = $1 ORDER BY number`,
    [req.userId],
  )
  res.json({ restaurants: rows.map(toRestaurant) })
})

module.exports = { router, toRestaurant }
