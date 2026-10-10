const express = require('express')
const { pool, transaction } = require('../db')
const { ValidationError, text, optionalText, isUuid, username } = require('../validate')
const {
  ensureProfile,
  userId,
  profileColumns,
  toProfile,
  toPlacement,
  canSeeReview,
  canSeeAccount,
  reviewColumns,
  reviewFrom,
  toReview,
} = require('../social')
const router = express.Router()

// Your own profile, plus which onboarding steps are left: picking a username, then the tour
async function loadMe(id) {
  const { rows } = await pool.query(
    `SELECT ${profileColumns}, p.handle_set_at, p.tour_done_at FROM profiles p WHERE p.user_id = $1`,
    [id],
  )
  return {
    profile: toProfile(rows[0]),
    onboarding: { needsUsername: !rows[0].handle_set_at, needsTour: !rows[0].tour_done_at },
  }
}

const usernameTaken = (res) => res.status(409).json({ error: 'That username is already taken. Try another one.' })

router.get('/me', async (req, res) => {
  await ensureProfile(req.userId)
  res.json(await loadMe(req.userId))
})

router.patch('/me', async (req, res) => {
  await ensureProfile(req.userId)
  const name = text(req.body?.name, 'Name', { min: 1, max: 60 })
  const requested = text(req.body?.handle, 'Username', { min: 1, max: 30 }).toLowerCase()
  const { rows } = await pool.query('SELECT handle FROM profiles WHERE user_id = $1', [req.userId])
  // A username chosen before the 10-character rule stays valid until its owner changes it
  const handle = requested === rows[0].handle ? requested : username(requested)
  const bio = optionalText(req.body?.bio, 'Bio', { max: 280 })
  try {
    await pool.query(
      `UPDATE profiles SET display_name = $2, handle = $3, bio = $4,
         handle_set_at = CASE WHEN handle <> $3 THEN now() ELSE handle_set_at END
       WHERE user_id = $1`,
      [req.userId, name, handle, bio],
    )
  } catch (error) {
    if (error.code === '23505') return usernameTaken(res)
    throw error
  }
  res.json(await loadMe(req.userId))
})

// PUT /api/profiles/me/username { handle }: the first onboarding step, right after sign-up
router.put('/me/username', async (req, res) => {
  await ensureProfile(req.userId)
  const handle = username(req.body?.handle)
  try {
    await pool.query('UPDATE profiles SET handle = $2, handle_set_at = now() WHERE user_id = $1', [req.userId, handle])
  } catch (error) {
    if (error.code === '23505') return usernameTaken(res)
    throw error
  }
  res.json(await loadMe(req.userId))
})

// PUT /api/profiles/me/tour: the welcome tour was finished or skipped, so it never shows again
router.put('/me/tour', async (req, res) => {
  await ensureProfile(req.userId)
  const { rowCount } = await pool.query('UPDATE profiles SET tour_done_at = COALESCE(tour_done_at, now()) WHERE user_id = $1 AND handle_set_at IS NOT NULL', [req.userId])
  if (!rowCount) throw new ValidationError('Choose a username before completing the tour.')
  res.json(await loadMe(req.userId))
})

// Top picks: one all-time favourite place per category, with the dish to order there.
// Only places with a shared review show, so a top pick never reveals a private visit.
const MAX_TOP_PICKS = 8

async function loadTopPicks(profileId, db = pool, viewer = profileId) {
  const { rows } = await db.query(
    `SELECT tp.category, tp.dish, r.id, r.name, r.address, r.category AS restaurant_category,
       round(avg(v.rating), 1)::float AS rating, count(v.id)::int AS review_count,
       (SELECT m.id FROM media m JOIN visit_logs pv ON pv.id = m.visit_id
         WHERE pv.restaurant_id = r.id AND pv.is_public AND ${canSeeReview('pv')} ORDER BY pv.visit_date DESC, m.created_at DESC LIMIT 1) AS photo_id
     FROM top_picks tp
     JOIN restaurants r ON r.id = tp.restaurant_id
     JOIN visit_logs v ON v.restaurant_id = r.id AND v.is_public AND ${canSeeReview()}
     WHERE tp.user_id = $2
     GROUP BY tp.position, tp.category, tp.dish, r.id
     ORDER BY tp.position`,
    [viewer, profileId],
  )
  return rows.map((row) => ({
    category: row.category,
    dish: row.dish,
    restaurant: {
      id: row.id,
      name: row.name,
      address: row.address,
      category: row.restaurant_category,
      rating: row.rating,
      reviewCount: row.review_count,
      photoId: row.photo_id,
    },
  }))
}

// PUT /api/profiles/me/top-picks { picks: [{ category, restaurantId, dish }] }
// Replaces all top picks, in this order: one per category (up to eight), each a place with a shared review.
router.put('/me/top-picks', async (req, res) => {
  const picks = req.body?.picks
  if (!Array.isArray(picks) || picks.length > MAX_TOP_PICKS) {
    throw new ValidationError(`Choose up to ${MAX_TOP_PICKS} top picks.`)
  }
  const clean = picks.map((pick, index) => {
    const label = `Top pick ${index + 1}`
    if (!isUuid(pick?.restaurantId)) throw new ValidationError(`${label}: choose a restaurant.`)
    return {
      category: text(pick.category, `${label} category`, { min: 1, max: 40 }).replace(/\s+/g, ' '),
      restaurantId: pick.restaurantId,
      dish: optionalText(pick.dish, `${label} dish`, { max: 80 }),
    }
  })
  if (new Set(clean.map((pick) => pick.category.toLowerCase())).size !== clean.length) {
    throw new ValidationError('Each category can have one top pick.')
  }
  const places = [...new Set(clean.map((pick) => pick.restaurantId))]
  if (places.length) {
    const { rows } = await pool.query(
      `SELECT DISTINCT restaurant_id FROM visit_logs WHERE user_id = $1 AND is_public AND restaurant_id = ANY($2::uuid[])`,
      [req.userId, places],
    )
    if (rows.length !== places.length)
      throw new ValidationError('Top picks must be restaurants you have shared a review of.')
  }
  await ensureProfile(req.userId)
  const topPicks = await transaction(async (client) => {
    await client.query('DELETE FROM top_picks WHERE user_id = $1', [req.userId])
    if (clean.length) {
      await client.query(
        `INSERT INTO top_picks (user_id, position, category, restaurant_id, dish)
         SELECT $1, pick.position, pick.category, pick.restaurant_id, pick.dish
         FROM unnest($2::text[], $3::uuid[], $4::text[]) WITH ORDINALITY AS pick(category, restaurant_id, dish, position)`,
        [req.userId, clean.map((p) => p.category), clean.map((p) => p.restaurantId), clean.map((p) => p.dish)],
      )
    }
    return loadTopPicks(req.userId, client)
  })
  res.json({ topPicks })
})

// GET /api/profiles/feed?scope=foryou|following|discover&before=<ISO time>
// For you (Home's main feed, like a "for you" page): shared reviews written or co-written by diners
// you follow, the reviews they reposted, and your own reposts.
// Following: the same without your own reposts. Discover: every other diner's shared reviews.
// A review shows once, at its latest post or repost, with everyone who reposted it, newest first.
// Pages hold 20 reviews; pass the last review's activityAt as `before` for the next page.
router.get('/feed', async (req, res) => {
  const scope = ['foryou', 'following'].includes(req.query.scope) ? req.query.scope : 'discover'
  let before = null
  if (req.query.before !== undefined) {
    const date = new Date(String(req.query.before))
    if (Number.isNaN(date.getTime())) throw new ValidationError('before must be a date and time.')
    before = date.toISOString()
  }
  const followed = (column) => `EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.following_id = ${column})`
  const byPeopleYouFollow = `(${followed('v.user_id')} OR EXISTS (SELECT 1 FROM visit_coauthors co
    WHERE co.visit_id = v.id AND co.status = 'accepted' AND ${followed('co.user_id')}))`
  const reposters = `(${scope === 'foryou' ? `(rp.user_id = $1 OR ${followed('rp.user_id')})` : `v.user_id <> $1 AND ${followed('rp.user_id')}`}) AND ${canSeeAccount('rp.user_id')}`
  const items =
    scope === 'discover'
      ? 'SELECT v.id AS visit_id, v.created_at AS at, NULL::uuid AS reposter_id FROM visit_logs v WHERE v.is_public AND v.user_id <> $1'
      : `SELECT v.id AS visit_id, v.created_at AS at, NULL::uuid AS reposter_id
         FROM visit_logs v WHERE v.is_public AND v.user_id <> $1 AND ${byPeopleYouFollow}
         UNION ALL
         SELECT rp.visit_id, rp.created_at, rp.user_id
         FROM review_reposts rp JOIN visit_logs v ON v.id = rp.visit_id
         WHERE v.is_public AND ${reposters}`
  const { rows } = await pool.query(
    `WITH items AS (${items}),
     latest AS (SELECT visit_id, max(at) AS at FROM items GROUP BY visit_id)
     SELECT ${reviewColumns}, latest.at AS activity_at,
       (SELECT json_agg(json_build_object('id', rpp.user_id, 'name', rpp.display_name, 'handle', rpp.handle)
           ORDER BY i.at DESC)
         FROM items i JOIN profiles rpp ON rpp.user_id = i.reposter_id WHERE i.visit_id = latest.visit_id) AS reposters
     FROM latest JOIN visit_logs v ON v.id = latest.visit_id JOIN restaurants r ON r.id = v.restaurant_id
     WHERE ${canSeeReview()} AND ($2::timestamptz IS NULL OR latest.at < $2::timestamptz)
     ORDER BY latest.at DESC, v.id DESC LIMIT 20`,
    [req.userId, before],
  )
  res.json({ reviews: rows.map(toReview) })
})

router.get('/friends', async (req, res) => {
  await ensureProfile(req.userId)
  const { rows } = await pool.query(
    `SELECT ${profileColumns} FROM profiles p
     WHERE p.user_id <> $1
       AND (EXISTS (SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = p.user_id)
         OR EXISTS (SELECT 1 FROM follows WHERE follower_id = p.user_id AND following_id = $1))
     ORDER BY lower(p.display_name), p.handle LIMIT 300`,
    [req.userId],
  )
  const people = rows.map(toProfile)
  res.json({
    friends: people.filter((person) => person.isFriend),
    followBack: people.filter((person) => person.followsYou && !person.isFollowing),
    following: people.filter((person) => person.isFollowing && !person.followsYou),
  })
})

router.get('/', async (req, res) => {
  const query = optionalText(req.query.q, 'Search', { max: 60 })
  const { rows } = await pool.query(
    `SELECT ${profileColumns} FROM profiles p
     WHERE p.user_id <> $1 AND (strpos(lower(p.handle), lower($2)) > 0 OR strpos(lower(p.display_name), lower($2)) > 0)
     ORDER BY is_following ASC, review_count DESC, p.created_at DESC LIMIT 40`,
    [req.userId, query],
  )
  res.json({ profiles: rows.map(toProfile) })
})

router.get('/:id/connections', async (req, res) => {
  const id = userId(req.params.id)
  const following = req.query.type === 'following'
  const { rows } = await pool.query(
    `SELECT ${profileColumns} FROM profiles p JOIN follows f ON p.user_id = f.${following ? 'following_id' : 'follower_id'}
     WHERE f.${following ? 'follower_id' : 'following_id'} = $2 AND ${canSeeAccount('$2')} ORDER BY f.created_at DESC LIMIT 100`,
    [req.userId, id],
  )
  res.json({ profiles: rows.map(toProfile) })
})

router.put('/:id/follow', async (req, res) => {
  const id = userId(req.params.id)
  if (id === req.userId) throw new ValidationError('You cannot follow yourself.')
  await ensureProfile(req.userId)
  const target = await pool.query('SELECT user_id FROM profiles WHERE user_id = $1', [id])
  if (!target.rows.length) return res.status(404).json({ error: 'Profile not found.' })
  await pool.query(`WITH added AS (
    INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)
    ON CONFLICT DO NOTHING RETURNING follower_id, following_id
  ) INSERT INTO notifications (recipient_id, actor_id, kind)
    SELECT following_id, follower_id, 'follow' FROM added
    WHERE COALESCE((SELECT follows FROM notification_preferences WHERE user_id = following_id), true)`, [
    req.userId,
    id,
  ])
  const { rows } = await pool.query(`SELECT ${profileColumns} FROM profiles p WHERE p.user_id = $2`, [
    req.userId,
    id,
  ])
  res.json({ profile: toProfile(rows[0]) })
})

router.delete('/:id/follow', async (req, res) => {
  const id = userId(req.params.id)
  await pool.query('DELETE FROM follows WHERE follower_id = $1 AND following_id = $2', [req.userId, id])
  const { rows } = await pool.query(`SELECT ${profileColumns} FROM profiles p WHERE p.user_id = $2`, [
    req.userId,
    id,
  ])
  if (!rows.length) return res.status(404).json({ error: 'Profile not found.' })
  res.json({ profile: toProfile(rows[0]) })
})

router.get('/:id', async (req, res) => {
  const id = userId(req.params.id)
  const { rows } = await pool.query(`SELECT ${profileColumns} FROM profiles p WHERE p.user_id = $2`, [
    req.userId,
    id,
  ])
  if (!rows.length) return res.status(404).json({ error: 'Profile not found.' })
  // Reviews they wrote or co-wrote that you can see (on your own profile, private ones too),
  // reviews they reposted, their restaurants with shared reviews, and the stickers on their card
  const profile = toProfile(rows[0])
  if (profile.isPrivate && id !== req.userId && !profile.isFriend) {
    return res.json({ profile, restricted: true, reviews: [], restaurants: [], reposts: [], stickers: [], topPicks: [] })
  }
  const [reviews, restaurants, reposts, stickers, topPicks] = await Promise.all([
    pool.query(
      `SELECT ${reviewColumns} ${reviewFrom}
      WHERE (v.user_id = $2 OR EXISTS (SELECT 1 FROM visit_coauthors pc
          WHERE pc.visit_id = v.id AND pc.user_id = $2 AND pc.status = 'accepted'))
        AND ${canSeeReview()}
      ORDER BY v.visit_date DESC, v.created_at DESC LIMIT 20`,
      [req.userId, id],
    ),
    pool.query(
      `SELECT r.id, r.name, r.address, r.category, round(avg(v.rating), 1)::float AS rating, count(*)::int AS review_count,
      (SELECT m.id FROM media m JOIN visit_logs pv ON pv.id = m.visit_id
        WHERE pv.restaurant_id = r.id AND pv.is_public AND ${canSeeReview('pv')} ORDER BY pv.visit_date DESC, m.created_at DESC LIMIT 1) AS photo_id
      FROM restaurants r JOIN visit_logs v ON v.restaurant_id = r.id AND v.is_public AND ${canSeeReview()}
      WHERE r.user_id = $2 GROUP BY r.id ORDER BY max(v.visit_date) DESC, r.name LIMIT 100`,
      [req.userId, id],
    ),
    pool.query(
      `SELECT ${reviewColumns} FROM review_reposts rp
      JOIN visit_logs v ON v.id = rp.visit_id AND v.is_public JOIN restaurants r ON r.id = v.restaurant_id
      WHERE rp.user_id = $2 AND ${canSeeReview()} ORDER BY rp.created_at DESC LIMIT 20`,
      [req.userId, id],
    ),
    pool.query(
      'SELECT id, sticker_id, x, y, rotation, scale FROM sticker_placements WHERE profile_id = $1 ORDER BY created_at, id',
      [id],
    ),
    loadTopPicks(id, pool, req.userId),
  ])
  res.json({
    profile: toProfile(rows[0]),
    reviews: reviews.rows.map(toReview),
    restaurants: restaurants.rows.map((r) => ({
      id: r.id,
      name: r.name,
      address: r.address,
      category: r.category,
      rating: r.rating,
      reviewCount: r.review_count,
      photoId: r.photo_id,
    })),
    reposts: reposts.rows.map(toReview),
    stickers: stickers.rows.map(toPlacement),
    topPicks,
  })
})

module.exports = { router }
