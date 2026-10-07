const express = require('express')
const { pool, transaction } = require('../db')
const { ValidationError, text, optionalText, integer, score, money, visitDate, isUuid } = require('../validate')
const { reviewColumns, reviewFrom, toReview, loadReview, areFriends, ensureProfile } = require('../social')
const { toRestaurant, readCategory } = require('./restaurants')
const { readPlacement } = require('./stickers')

const router = express.Router()
const MAX_DISHES = 20
const MAX_REVIEW_STICKERS = 12

// GET /api/visits: the user's visits, newest first, each with its dishes in ticket order
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${reviewColumns} ${reviewFrom} WHERE v.user_id = $1 ORDER BY v.visit_date DESC, v.created_at DESC`,
    [req.userId],
  )
  res.json({ visits: rows.map(toReview) })
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
    // Each item is reviewed on its own: a score out of 10 (past 10 for the special ones),
    // a short note, and optionally one sticker
    dishes: body.dishes.map((dish, index) => {
      const label = `Dish ${index + 1}`
      return {
        name: text(dish?.name, `${label} name`, { min: 1, max: 80 }),
        price: money(dish?.price ?? 0, `${label} price`),
        score: score(dish?.score, `${label} score`),
        description: optionalText(dish?.description, `${label} note`, { max: 500 }),
        sticker: dish?.sticker == null ? null : readPlacement(dish.sticker, `${label} sticker`),
      }
    }),
    category: readCategory(body.category),
  }

  if (body.isPublic !== undefined && typeof body.isPublic !== 'boolean')
    throw new ValidationError('Sharing must be true or false.')
  ticket.isPublic = body.isPublic ?? false
  const stickers = body.stickers === undefined ? [] : body.stickers
  if (!Array.isArray(stickers) || stickers.length > MAX_REVIEW_STICKERS)
    throw new ValidationError(`A review can hold up to ${MAX_REVIEW_STICKERS} stickers.`)
  ticket.stickers = stickers.map((sticker, index) => readPlacement(sticker, `Review sticker ${index + 1}`))
  ticket.photoIds = body.photoIds ?? []
  if (
    !Array.isArray(ticket.photoIds) ||
    ticket.photoIds.length > 3 ||
    ticket.photoIds.some((id) => !isUuid(id)) ||
    new Set(ticket.photoIds).size !== ticket.photoIds.length
  ) {
    throw new ValidationError('Attach up to three different photos.')
  }
  if (body.coauthorId != null && !isUuid(body.coauthorId)) throw new ValidationError('Choose a friend to invite.')
  ticket.coauthorId = body.coauthorId ?? null
  if (body.boxId != null && !isUuid(body.boxId)) throw new ValidationError('Choose a box from your collection.')
  ticket.boxId = body.boxId ?? null

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

const RESTAURANT_COLUMNS = 'id, number, google_place_id, name, address, category'

// Find the restaurant this ticket belongs to, or file it if it is new.
async function findOrFileRestaurant(client, userId, ticket) {
  if (ticket.restaurantId) {
    const { rows } = await client.query(
      `SELECT ${RESTAURANT_COLUMNS} FROM restaurants WHERE id = $1 AND user_id = $2`,
      [ticket.restaurantId, userId],
    )
    return rows[0] ?? null
  }

  const { placeId, name, address } = ticket.place
  const existing = placeId
    ? await client.query(
        `SELECT ${RESTAURANT_COLUMNS}
         FROM restaurants WHERE user_id = $1 AND google_place_id = $2`,
        [userId, placeId],
      )
    : await client.query(
        `SELECT ${RESTAURANT_COLUMNS}
         FROM restaurants
         WHERE user_id = $1 AND google_place_id IS NULL
           AND lower(name) = lower($2) AND lower(address) = lower($3)`,
        [userId, name, address],
      )
  if (existing.rows[0]) return existing.rows[0]

  // Next catalog number for this user (R-001, R-002, ...)
  const { rows } = await client.query(
    `INSERT INTO restaurants (user_id, number, google_place_id, name, address, category)
     SELECT $1, COALESCE(MAX(number), 0) + 1, $2, $3, $4, $5 FROM restaurants WHERE user_id = $1
     RETURNING ${RESTAURANT_COLUMNS}`,
    [userId, placeId, name, address, ticket.category],
  )
  return rows[0]
}

// POST /api/visits: save one ticket and its optional box, photos, stickers
// and co-author invite in a single transaction. Any problem saves nothing.
router.post('/', async (req, res) => {
  const ticket = readTicket(req.body)
  await ensureProfile(req.userId)
  if (ticket.coauthorId) {
    if (ticket.coauthorId === req.userId) throw new ValidationError('You are already an author of this review.')
    await ensureProfile(req.userId)
  }

  const saved = await transaction(async (client) => {
    // One ticket at a time per user, so two tabs cannot hand out the same catalog number
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [req.userId])

    if (ticket.boxId) {
      const box = await client.query('SELECT id FROM boxes WHERE id = $1 AND user_id = $2 FOR KEY SHARE', [
        ticket.boxId,
        req.userId,
      ])
      if (!box.rowCount) throw new ValidationError('This box is unavailable. Choose another box from your collection.')
    }

    let restaurant = await findOrFileRestaurant(client, req.userId, ticket)
    if (!restaurant) return null
    // A category chosen on the ticket also sorts a place already on file
    if (ticket.category && ticket.category !== restaurant.category) {
      const updated = await client.query(
        `UPDATE restaurants SET category = $3 WHERE id = $1 AND user_id = $2 RETURNING ${RESTAURANT_COLUMNS}`,
        [restaurant.id, req.userId, ticket.category],
      )
      restaurant = updated.rows[0]
    }

    // Boxes collect restaurants with all their reviews. A repeat visit must not file
    // the same restaurant twice, and failures later in the ticket undo this too.
    if (ticket.boxId) {
      await client.query(
        `INSERT INTO box_restaurants (box_id, restaurant_id, user_id) VALUES ($1, $2, $3)
         ON CONFLICT (box_id, restaurant_id) DO NOTHING`,
        [ticket.boxId, restaurant.id, req.userId],
      )
    }

    const { rows } = await client.query(
      `INSERT INTO visit_logs (user_id, restaurant_id, visit_date, rating, notes, is_public)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [req.userId, restaurant.id, ticket.date, ticket.rating, ticket.notes, ticket.isPublic],
    )
    const visitId = rows[0].id
    const dishes = await client.query(
      `INSERT INTO dishes (visit_log_id, position, name, price, score, description)
       SELECT $1, dish.position, dish.name, dish.price, dish.score, dish.description
       FROM unnest($2::text[], $3::numeric[], $4::smallint[], $5::text[])
         WITH ORDINALITY AS dish(name, price, score, description, position)
       RETURNING id, position`,
      [
        visitId,
        ticket.dishes.map((dish) => dish.name),
        ticket.dishes.map((dish) => dish.price),
        ticket.dishes.map((dish) => dish.score),
        ticket.dishes.map((dish) => dish.description),
      ],
    )
    const dishIds = new Map(dishes.rows.map((row) => [Number(row.position), row.id]))
    for (const [index, dish] of ticket.dishes.entries()) {
      if (!dish.sticker) continue
      const { stickerId, x, y, rotation, scale } = dish.sticker
      const placed = await client.query(
        `INSERT INTO sticker_placements (user_id, sticker_id, dish_id, x, y, rotation, scale)
         SELECT $1, s.id, $3, $4, $5, $6, $7 FROM stickers s WHERE s.id = $2 AND s.user_id = $1`,
        [req.userId, stickerId, dishIds.get(index + 1), x, y, rotation, scale],
      )
      if (placed.rowCount !== 1)
        throw new ValidationError('One of your stickers is unavailable. Choose it again.')
    }
    for (const { stickerId, x, y, rotation, scale } of ticket.stickers) {
      const placed = await client.query(
        `INSERT INTO sticker_placements (user_id, sticker_id, visit_id, x, y, rotation, scale)
         SELECT $1, s.id, $3, $4, $5, $6, $7 FROM stickers s WHERE s.id = $2 AND s.user_id = $1`,
        [req.userId, stickerId, visitId, x, y, rotation, scale],
      )
      if (placed.rowCount !== 1)
        throw new ValidationError('One of your stickers is unavailable. Choose it again.')
    }
    if (ticket.photoIds.length) {
      const attached = await client.query(
        `UPDATE media SET visit_id = $1 WHERE id = ANY($2::uuid[]) AND user_id = $3 AND kind = 'review' AND visit_id IS NULL`,
        [visitId, ticket.photoIds, req.userId],
      )
      if (attached.rowCount !== ticket.photoIds.length)
        throw new ValidationError('One of your photos is unavailable. Remove it and upload it again.')
    }
    if (ticket.coauthorId) {
      if (!(await areFriends(req.userId, ticket.coauthorId, client)))
        throw new ValidationError('You can invite friends only: someone you follow who follows you back.')
      await client.query('INSERT INTO visit_coauthors (visit_id, user_id) VALUES ($1, $2)', [
        visitId,
        ticket.coauthorId,
      ])
    }
    return {
      restaurant,
      visit: await loadReview(req.userId, visitId, client),
      boxMembership: ticket.boxId ? { boxId: ticket.boxId, restaurantId: restaurant.id } : null,
    }
  })

  if (!saved) return res.status(404).json({ error: 'Restaurant not found.' })
  res.status(201).json({
    restaurant: toRestaurant(saved.restaurant),
    visit: saved.visit,
    boxMembership: saved.boxMembership,
  })
})

// Full review edit. Keep existing dish IDs (and their references), photos, review
// stickers and co-authors. A stale editor cannot overwrite a newer revision.
router.put('/:id', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Review not found.' })
  const revision = integer(req.body?.revision, 'Revision', { min: 1, max: 2147483647 })
  const result = await transaction(async (client) => {
    const owned = await client.query('SELECT * FROM visit_logs WHERE id = $1 AND user_id = $2 FOR UPDATE', [req.params.id, req.userId])
    if (!owned.rowCount) return null
    if (owned.rows[0].revision !== revision) return { conflict: true }
    const ticket = readTicket({ ...req.body, restaurantId: owned.rows[0].restaurant_id, photoIds: [], stickers: [], coauthorId: null, boxId: null })
    const previous = await client.query('SELECT id FROM dishes WHERE visit_log_id = $1', [req.params.id])
    const ownedIds = new Set(previous.rows.map((row) => row.id))
    const retained = req.body.dishes.flatMap((dish) => dish.id == null ? [] : [dish.id])
    if (new Set(retained).size !== retained.length || retained.some((id) => !ownedIds.has(id))) {
      throw new ValidationError('One of these items does not belong to this review.')
    }
    await client.query('DELETE FROM dishes WHERE visit_log_id = $1 AND NOT (id = ANY($2::uuid[]))', [req.params.id, retained])
    await client.query('UPDATE dishes SET position = position + 100 WHERE visit_log_id = $1', [req.params.id])
    for (const [index, dish] of ticket.dishes.entries()) {
      const id = req.body.dishes[index].id
      let dishId = id
      if (id) {
        await client.query('UPDATE dishes SET position = $2, name = $3, price = $4, score = $5, description = $6 WHERE id = $1', [id, index + 1, dish.name, dish.price, dish.score, dish.description])
      } else {
        const added = await client.query('INSERT INTO dishes (visit_log_id, position, name, price, score, description) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', [req.params.id, index + 1, dish.name, dish.price, dish.score, dish.description])
        dishId = added.rows[0].id
      }
      // Omitted sticker means preserve; explicit null removes it.
      if (Object.hasOwn(req.body.dishes[index], 'sticker')) {
        await client.query('DELETE FROM sticker_placements WHERE dish_id = $1', [dishId])
        if (dish.sticker) {
          const s = dish.sticker
          const placed = await client.query(`INSERT INTO sticker_placements (user_id, sticker_id, dish_id, x, y, rotation, scale)
            SELECT $1, id, $3, $4, $5, $6, $7 FROM stickers WHERE id = $2 AND user_id = $1`, [req.userId, s.stickerId, dishId, s.x, s.y, s.rotation, s.scale])
          if (!placed.rowCount) throw new ValidationError('One of your stickers is unavailable.')
        }
      }
    }
    await client.query(`UPDATE visit_logs SET visit_date=$3, rating=$4, notes=$5, is_public=$6,
      revision=revision+1, edited_at=now() WHERE id=$1 AND user_id=$2`, [req.params.id, req.userId, ticket.date, ticket.rating, ticket.notes, req.body.isPublic ?? owned.rows[0].is_public])
    return { review: await loadReview(req.userId, req.params.id, client) }
  })
  if (!result) return res.status(404).json({ error: 'Review not found.' })
  if (result.conflict) return res.status(409).json({ error: 'This review changed in another tab. Reload it before editing again.' })
  res.json(result)
})

router.delete('/:id', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Review not found.' })
  const { rowCount } = await pool.query('DELETE FROM visit_logs WHERE id = $1 AND user_id = $2', [req.params.id, req.userId])
  if (!rowCount) return res.status(404).json({ error: 'Review not found.' })
  res.json({ ok: true })
})

router.patch('/:id', async (req, res) => {
  if (!isUuid(req.params.id) || typeof req.body?.isPublic !== 'boolean')
    throw new ValidationError('Send a valid review id and sharing setting.')
  const { rowCount } = await pool.query(
    'UPDATE visit_logs SET is_public = $3, revision = revision + 1 WHERE id = $1 AND user_id = $2',
    [req.params.id, req.userId, req.body.isPublic],
  )
  if (!rowCount) return res.status(404).json({ error: 'Review not found.' })
  res.json({ id: req.params.id, isPublic: req.body.isPublic })
})

module.exports = { router }
