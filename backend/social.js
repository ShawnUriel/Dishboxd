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

// $1 is always the signed-in viewer, so every profile says whether they follow each other
const profileColumns = `p.user_id, p.handle, p.display_name, p.bio, p.avatar_id, p.top_pick_ids,
  (SELECT count(*)::int FROM follows WHERE following_id = p.user_id) AS follower_count,
  (SELECT count(*)::int FROM follows WHERE follower_id = p.user_id) AS following_count,
  (SELECT count(*)::int FROM visit_logs WHERE user_id = p.user_id AND is_public) AS review_count,
  EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = p.user_id) AS is_following,
  EXISTS(SELECT 1 FROM follows WHERE follower_id = p.user_id AND following_id = $1) AS follows_you`

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
    followsYou: row.follows_you,
    // Friends follow each other
    isFriend: row.is_following && row.follows_you,
  }
}

// One sticker on a card: which sticker, where (percent of the card), tilt and size
const placementJson = (alias) =>
  `json_build_object('id', ${alias}.id, 'stickerId', ${alias}.sticker_id, 'x', ${alias}.x, 'y', ${alias}.y,
    'rotation', ${alias}.rotation, 'scale', ${alias}.scale)`

function toPlacement(row) {
  return { id: row.id, stickerId: row.sticker_id, x: row.x, y: row.y, rotation: row.rotation, scale: row.scale }
}

// A review is visible to the viewer ($1) when it is shared, theirs, or they were invited to co-author it
const canSeeReview = (alias = 'v') => `(${alias}.is_public OR ${alias}.user_id = $1
  OR EXISTS (SELECT 1 FROM visit_coauthors cs WHERE cs.visit_id = ${alias}.id AND cs.user_id = $1))`

// Everything a review card shows. Use with FROM visit_logs v JOIN restaurants r, and the viewer as $1.
// A pending co-author is shown only to the author and the person invited.
const reviewColumns = `v.id, v.user_id, v.restaurant_id, v.visit_date, v.rating, v.notes, v.is_public, v.created_at,
  r.name AS restaurant_name, r.address AS restaurant_address, r.category AS restaurant_category,
  COALESCE((SELECT json_agg(json_build_object('id', d.id, 'name', d.name, 'price', d.price, 'score', d.score,
      'description', d.description,
      'sticker', (SELECT ${placementJson('dsp')} FROM sticker_placements dsp WHERE dsp.dish_id = d.id))
    ORDER BY d.position) FROM dishes d WHERE d.visit_log_id = v.id), '[]') AS dishes,
  COALESCE((SELECT json_agg(m.id ORDER BY m.created_at, m.id) FROM media m WHERE m.visit_id = v.id), '[]') AS photo_ids,
  COALESCE((SELECT json_agg(${placementJson('vsp')} ORDER BY vsp.created_at, vsp.id)
    FROM sticker_placements vsp WHERE vsp.visit_id = v.id), '[]') AS stickers,
  (SELECT count(*)::int FROM review_likes rl WHERE rl.visit_id = v.id) AS like_count,
  EXISTS (SELECT 1 FROM review_likes rl WHERE rl.visit_id = v.id AND rl.user_id = $1) AS liked,
  (SELECT count(*)::int FROM review_reposts rr WHERE rr.visit_id = v.id) AS repost_count,
  EXISTS (SELECT 1 FROM review_reposts rr WHERE rr.visit_id = v.id AND rr.user_id = $1) AS reposted,
  (SELECT json_build_object('id', ap.user_id, 'name', ap.display_name, 'handle', ap.handle, 'avatarId', ap.avatar_id)
    FROM profiles ap WHERE ap.user_id = v.user_id) AS author,
  (SELECT json_build_object('id', cp.user_id, 'name', cp.display_name, 'handle', cp.handle, 'avatarId', cp.avatar_id,
      'status', ca.status)
    FROM visit_coauthors ca JOIN profiles cp ON cp.user_id = ca.user_id
    WHERE ca.visit_id = v.id AND (ca.status = 'accepted' OR v.user_id = $1 OR ca.user_id = $1)) AS coauthor`

const reviewFrom = 'FROM visit_logs v JOIN restaurants r ON r.id = v.restaurant_id'

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
    stickers: row.stickers,
    likeCount: row.like_count,
    liked: row.liked,
    repostCount: row.repost_count,
    reposted: row.reposted,
    author: row.author,
    coauthor: row.coauthor,
    restaurant: {
      id: row.restaurant_id,
      name: row.restaurant_name,
      address: row.restaurant_address,
      category: row.restaurant_category,
    },
    // In feeds: who reposted it (newest first; repostedBy is the latest) and when it last moved
    ...(row.reposters ? { reposters: row.reposters, repostedBy: row.reposters[0] } : {}),
    ...(row.activity_at ? { activityAt: row.activity_at } : {}),
  }
}

// One review the viewer may see, or null. `db` lets a transaction read its own writes.
async function loadReview(viewer, id, db = pool) {
  if (!isUuid(id)) return null
  const { rows } = await db.query(`SELECT ${reviewColumns} ${reviewFrom} WHERE v.id = $2 AND ${canSeeReview()}`, [
    viewer,
    id,
  ])
  return rows[0] ? toReview(rows[0]) : null
}

// Friends follow each other. Only friends can co-author a review.
async function areFriends(a, b, db = pool) {
  const { rows } = await db.query(
    `SELECT EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2)
        AND EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = $1) AS friends`,
    [a, b],
  )
  return rows[0].friends
}

module.exports = {
  userId,
  ensureProfile,
  profileColumns,
  toProfile,
  placementJson,
  toPlacement,
  canSeeReview,
  reviewColumns,
  reviewFrom,
  toReview,
  loadReview,
  areFriends,
}
