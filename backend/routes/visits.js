const express = require('express')
const { pool, transaction } = require('../db')
const { ValidationError, text, optionalText, integer, money, visitDate, isUuid } = require('../validate')
const { toRestaurant } = require('./restaurants')

const router = express.Router()
const MAX_DISHES = 20

function toVisit(row) {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    date: row.visit_date,
    rating: row.rating,
    notes: row.notes,
    dishes: row.dishes,
    photoIds: row.photo_ids ?? [],
    isPublic: row.is_public ?? false,
  }
}

// GET /api/visits: the user's visits, newest first, each with its dishes in ticket order
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT v.id, v.restaurant_id, v.visit_date, v.rating, v.notes, v.is_public,
            COALESCE((SELECT json_agg(m.id ORDER BY m.created_at, m.id) FROM media m WHERE m.visit_id = v.id), '[]') AS photo_ids,
            COALESCE(
              json_agg(json_build_object('name', d.name, 'price', d.price) ORDER BY d.position)
                FILTER (WHERE d.id IS NOT NULL),
              '[]'
            ) AS dishes
     FROM visit_logs v
     LEFT JOIN dishes d ON d.visit_log_id = v.id
     WHERE v.user_id = $1
     GROUP BY v.id
     ORDER BY v.visit_date DESC, v.created_at DESC`,
    [req.userId],
  )
  res.json({ visits: rows.map(toVisit) })
})

// Check the whole ticket before touching the database
function readTicket(body) {
  if (!body || typeof body !== 'object') throw new ValidationError('Send the visit as JSON.')
  if (!Array.isArray(body.dishes) || body.dishes.length === 0) {
    throw new ValidationError('Add at least one dish.')
  }
  if (body.dishes.length > MAX_DISHES)
    throw new ValidationError(`A ticket can have at most ${MAX_DISHES} dishes.`)

  const ticket = {
    date: visitDate(body.date),
    rating: integer(body.rating, 'Rating', { min: 1, max: 5 }),
    notes: optionalText(body.notes, 'Notes', { max: 2000 }),
    dishes: body.dishes.map((dish, index) => ({
      name: text(dish?.name, `Dish ${index + 1} name`, { min: 1, max: 80 }),
      price: money(dish?.price ?? 0, `Dish ${index + 1} price`),
    })),
  }

  if (body.isPublic !== undefined && typeof body.isPublic !== 'boolean')
    throw new ValidationError('Sharing must be true or false.')
  ticket.isPublic = body.isPublic ?? false
  ticket.photoIds = body.photoIds ?? []
  if (
    !Array.isArray(ticket.photoIds) ||
    ticket.photoIds.length > 3 ||
    ticket.photoIds.some((id) => !isUuid(id)) ||
    new Set(ticket.photoIds).size !== ticket.photoIds.length
  ) {
    throw new ValidationError('Attach up to three different photos.')
  }

  // Either an existing restaurant (restaurantId) or a place to file (from search or added by hand)
  if (body.restaurantId !== undefined) {
    if (!isUuid(body.restaurantId)) throw new ValidationError('restaurantId is not valid.')
    ticket.restaurantId = body.restaurantId
  } else {
    const place = body.place
    if (!place || typeof place !== 'object') throw new ValidationError('Choose a restaurant.')
    ticket.place = {
      placeId: place.placeId == null ? null : text(place.placeId, 'Place id', { min: 1, max: 300 }),
      name: text(place.name, 'Restaurant name', { min: 1, max: 100 }),
      address: optionalText(place.address, 'Address', { max: 120 }),
    }
  }
  return ticket
}

// Find the restaurant this ticket belongs to, or file it if it is new.
async function findOrFileRestaurant(client, userId, ticket) {
  if (ticket.restaurantId) {
    const { rows } = await client.query(
      `SELECT id, number, google_place_id, name, address FROM restaurants WHERE id = $1 AND user_id = $2`,
      [ticket.restaurantId, userId],
    )
    return rows[0] ?? null
  }

  const { placeId, name, address } = ticket.place
  const existing = placeId
    ? await client.query(
        `SELECT id, number, google_place_id, name, address
         FROM restaurants WHERE user_id = $1 AND google_place_id = $2`,
        [userId, placeId],
      )
    : await client.query(
        `SELECT id, number, google_place_id, name, address
         FROM restaurants
         WHERE user_id = $1 AND google_place_id IS NULL
           AND lower(name) = lower($2) AND lower(address) = lower($3)`,
        [userId, name, address],
      )
  if (existing.rows[0]) return existing.rows[0]

  // Next catalog number for this user (R-001, R-002, ...)
  const { rows } = await client.query(
    `INSERT INTO restaurants (user_id, number, google_place_id, name, address)
     SELECT $1, COALESCE(MAX(number), 0) + 1, $2, $3, $4 FROM restaurants WHERE user_id = $1
     RETURNING id, number, google_place_id, name, address`,
    [userId, placeId, name, address],
  )
  return rows[0]
}

// POST /api/visits: save one ticket (the visit and all its dishes) in a single transaction
router.post('/', async (req, res) => {
  const ticket = readTicket(req.body)

  const saved = await transaction(async (client) => {
    // One ticket at a time per user, so two tabs cannot hand out the same catalog number
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [req.userId])

    const restaurant = await findOrFileRestaurant(client, req.userId, ticket)
    if (!restaurant) return null

    const { rows } = await client.query(
      `INSERT INTO visit_logs (user_id, restaurant_id, visit_date, rating, notes, is_public)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, restaurant_id, visit_date, rating, notes, is_public`,
      [req.userId, restaurant.id, ticket.date, ticket.rating, ticket.notes, ticket.isPublic],
    )
    await client.query(
      `INSERT INTO dishes (visit_log_id, position, name, price)
       SELECT $1, dish.position, dish.name, dish.price
       FROM unnest($2::text[], $3::numeric[]) WITH ORDINALITY AS dish(name, price, position)`,
      [rows[0].id, ticket.dishes.map((dish) => dish.name), ticket.dishes.map((dish) => dish.price)],
    )
    if (ticket.photoIds.length) {
      const attached = await client.query(
        `UPDATE media SET visit_id = $1 WHERE id = ANY($2::uuid[]) AND user_id = $3 AND kind = 'review' AND visit_id IS NULL`,
        [rows[0].id, ticket.photoIds, req.userId],
      )
      if (attached.rowCount !== ticket.photoIds.length)
        throw new ValidationError('One of your photos is unavailable. Remove it and upload it again.')
    }
    return { restaurant, visit: { ...rows[0], dishes: ticket.dishes, photo_ids: ticket.photoIds } }
  })

  if (!saved) return res.status(404).json({ error: 'Restaurant not found.' })
  res.status(201).json({ restaurant: toRestaurant(saved.restaurant), visit: toVisit(saved.visit) })
})

router.patch('/:id', async (req, res) => {
  if (!isUuid(req.params.id) || typeof req.body?.isPublic !== 'boolean')
    throw new ValidationError('Send a valid review id and sharing setting.')
  const { rowCount } = await pool.query(
    'UPDATE visit_logs SET is_public = $3 WHERE id = $1 AND user_id = $2',
    [req.params.id, req.userId, req.body.isPublic],
  )
  if (!rowCount) return res.status(404).json({ error: 'Review not found.' })
  res.json({ id: req.params.id, isPublic: req.body.isPublic })
})

module.exports = { router }
