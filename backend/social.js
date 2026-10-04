const { pool } = require('./db')
const { ValidationError, isUuid } = require('./validate')

function userId(value) {
  if (!isUuid(value)) throw new ValidationError('Profile id is not valid.')
  return value
}

async function ensureProfile(id) {
  await pool.query(
    `INSERT INTO profiles (user_id, handle, display_name)
     SELECT id, 'diner_' || left(replace(id::text, '-', ''), 24), left(COALESCE(NULLIF(name, ''), 'Food lover'), 60)
     FROM neon_auth."user" WHERE id = $1 ON CONFLICT (user_id) DO NOTHING`,
    [id],
  )
}

const profileColumns = `p.user_id, p.handle, p.display_name, p.bio, p.avatar_id, p.top_pick_ids,
  (SELECT count(*)::int FROM follows WHERE following_id = p.user_id) AS follower_count,
  (SELECT count(*)::int FROM follows WHERE follower_id = p.user_id) AS following_count,
  (SELECT count(*)::int FROM visit_logs WHERE user_id = p.user_id AND is_public) AS review_count,
  EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = p.user_id) AS is_following`

function toProfile(row) {
  return {
    id: row.user_id,
    handle: row.handle,
    name: row.display_name,
    bio: row.bio,
    avatarId: row.avatar_id,
    topPickIds: row.top_pick_ids,
    followerCount: row.follower_count,
    followingCount: row.following_count,
    reviewCount: row.review_count,
    isFollowing: row.is_following,
  }
}

const reviewColumns = `v.id, v.restaurant_id, v.visit_date, v.rating, v.notes, v.is_public,
  r.name AS restaurant_name, r.address AS restaurant_address,
  COALESCE((SELECT json_agg(json_build_object('name', d.name, 'price', d.price) ORDER BY d.position)
    FROM dishes d WHERE d.visit_log_id = v.id), '[]') AS dishes,
  COALESCE((SELECT json_agg(m.id ORDER BY m.created_at, m.id) FROM media m WHERE m.visit_id = v.id), '[]') AS photo_ids`

function toReview(row) {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    date: row.visit_date,
    rating: row.rating,
    notes: row.notes,
    isPublic: row.is_public,
    dishes: row.dishes,
    photoIds: row.photo_ids,
    restaurant: { id: row.restaurant_id, name: row.restaurant_name, address: row.restaurant_address },
  }
}

module.exports = { userId, ensureProfile, profileColumns, toProfile, reviewColumns, toReview }
