const express = require('express')
const { pool } = require('../db')
const { ValidationError, text, optionalText, isUuid } = require('../validate')
const {
  ensureProfile,
  userId,
  profileColumns,
  toProfile,
  toPlacement,
  canSeeReview,
  reviewColumns,
  reviewFrom,
  toReview,
} = require('../social')
const router = express.Router()

router.get('/me', async (req, res) => {
  await ensureProfile(req.userId)
  const { rows } = await pool.query(`SELECT ${profileColumns} FROM profiles p WHERE p.user_id = $1`, [
    req.userId,
  ])
  res.json({ profile: toProfile(rows[0]) })
})

router.patch('/me', async (req, res) => {
  await ensureProfile(req.userId)
  const name = text(req.body?.name, 'Name', { min: 1, max: 60 })
  const handle = text(req.body?.handle, 'Username', { min: 3, max: 30 }).toLowerCase()
  if (!/^[a-z0-9_]+$/.test(handle))
    throw new ValidationError('Username can contain letters, numbers and underscores only.')
  const bio = optionalText(req.body?.bio, 'Bio', { max: 280 })
  const picks = req.body?.topPickIds ?? []
  if (
    !Array.isArray(picks) ||
    picks.length > 4 ||
    picks.some((id) => !isUuid(id)) ||
    new Set(picks).size !== picks.length
  ) {
    throw new ValidationError('Choose up to four different restaurants for your top picks.')
  }
  if (picks.length) {
    const { rows } = await pool.query(
      `SELECT DISTINCT restaurant_id FROM visit_logs WHERE user_id = $1 AND is_public AND restaurant_id = ANY($2::uuid[])`,
      [req.userId, picks],
    )
    if (rows.length !== picks.length)
      throw new ValidationError('Top picks must be restaurants you have shared a review of.')
  }
  try {
    await pool.query(
      `UPDATE profiles SET display_name = $2, handle = $3, bio = $4, top_pick_ids = $5 WHERE user_id = $1`,
      [req.userId, name, handle, bio, picks],
    )
  } catch (error) {
    if (error.code === '23505')
      return res.status(409).json({ error: 'That username is already taken. Try another one.' })
    throw error
  }
  const { rows } = await pool.query(`SELECT ${profileColumns} FROM profiles p WHERE p.user_id = $1`, [
    req.userId,
  ])
  res.json({ profile: toProfile(rows[0]) })
})

// GET /api/profiles/feed?scope=following|discover
// Following: shared reviews written or co-written by diners you follow, and the ones they reposted
// (a review shows once, with its latest repost). Discover: every other diner's shared reviews.
router.get('/feed', async (req, res) => {
  const following = req.query.scope === 'following'
  const followed = (column) => `EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.following_id = ${column})`
  const { rows } = await pool.query(
    `WITH items AS (
       SELECT v.id AS visit_id, v.created_at AS at, NULL::uuid AS reposter_id
       FROM visit_logs v
       WHERE v.is_public AND v.user_id <> $1
         ${following ? `AND (${followed('v.user_id')} OR EXISTS (SELECT 1 FROM visit_coauthors co
           WHERE co.visit_id = v.id AND co.status = 'accepted' AND ${followed('co.user_id')}))` : ''}
       ${following ? `UNION ALL
       SELECT rp.visit_id, rp.created_at, rp.user_id
       FROM review_reposts rp JOIN visit_logs v ON v.id = rp.visit_id
       WHERE v.is_public AND v.user_id <> $1 AND ${followed('rp.user_id')}` : ''}
     ), latest AS (
       SELECT DISTINCT ON (visit_id) visit_id, at, reposter_id FROM items ORDER BY visit_id, at DESC
     )
     SELECT ${reviewColumns},
       (SELECT json_build_object('id', rpp.user_id, 'name', rpp.display_name, 'handle', rpp.handle)
         FROM profiles rpp WHERE rpp.user_id = latest.reposter_id) AS reposted_by
     FROM latest JOIN visit_logs v ON v.id = latest.visit_id JOIN restaurants r ON r.id = v.restaurant_id
     ORDER BY latest.at DESC, v.id DESC LIMIT 20`,
    [req.userId],
  )
  res.json({ reviews: rows.map(toReview) })
})

// GET /api/profiles/friends: the people around your table. Friends follow each other;
// followBack follow you but you do not follow them yet; following you follow, not yet back.
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
     WHERE f.${following ? 'follower_id' : 'following_id'} = $2 ORDER BY f.created_at DESC LIMIT 100`,
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
  await pool.query('INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
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
  const [reviews, restaurants, reposts, stickers] = await Promise.all([
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
        WHERE pv.restaurant_id = r.id AND pv.is_public ORDER BY pv.visit_date DESC, m.created_at DESC LIMIT 1) AS photo_id
      FROM restaurants r JOIN visit_logs v ON v.restaurant_id = r.id AND v.is_public
      WHERE r.user_id = $1 GROUP BY r.id ORDER BY max(v.visit_date) DESC, r.name LIMIT 100`,
      [id],
    ),
    pool.query(
      `SELECT ${reviewColumns} FROM review_reposts rp
      JOIN visit_logs v ON v.id = rp.visit_id AND v.is_public JOIN restaurants r ON r.id = v.restaurant_id
      WHERE rp.user_id = $2 ORDER BY rp.created_at DESC LIMIT 20`,
      [req.userId, id],
    ),
    pool.query(
      'SELECT id, sticker_id, x, y, rotation, scale FROM sticker_placements WHERE profile_id = $1 ORDER BY created_at, id',
      [id],
    ),
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
  })
})

module.exports = { router }
