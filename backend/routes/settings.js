const express = require('express')
const { pool, transaction } = require('../db')
const { ensureProfile } = require('../social')
const { ValidationError } = require('../validate')
const router = express.Router()
async function load(userId, db = pool) {
  const { rows } = await db.query(`SELECT p.is_private AS "isPrivate", COALESCE(s.theme, 'system') AS theme,
    COALESCE(s.reduce_motion, false) AS "reduceMotion", COALESCE(s.default_review_public, false) AS "defaultReviewPublic"
    FROM profiles p LEFT JOIN account_settings s ON s.user_id = p.user_id WHERE p.user_id = $1`, [userId])
  return rows[0]
}
router.get('/', async (req, res) => {
  await ensureProfile(req.userId)
  res.json({ settings: await load(req.userId) })
})
router.patch('/', async (req, res) => {
  const body = req.body
  const keys = ['theme', 'reduceMotion', 'defaultReviewPublic', 'isPrivate']
  if (!body || !Object.keys(body).length || Object.keys(body).some(key => !keys.includes(key))) throw new ValidationError('Choose a valid setting to update.')
  if (body.theme !== undefined && !['system', 'light', 'dark'].includes(body.theme)) throw new ValidationError('Choose Light, Dark, or System.')
  for (const key of keys.slice(1)) if (body[key] !== undefined && typeof body[key] !== 'boolean') throw new ValidationError('Settings must be on or off.')
  await ensureProfile(req.userId)
  const settings = await transaction(async client => {
    await client.query('SELECT user_id FROM profiles WHERE user_id=$1 FOR UPDATE', [req.userId])
    if (body.isPrivate !== undefined) await client.query('UPDATE profiles SET is_private=$2 WHERE user_id=$1', [req.userId, body.isPrivate])
    await client.query(`INSERT INTO account_settings (user_id, theme, reduce_motion, default_review_public)
      VALUES ($1, COALESCE($2, 'system'), COALESCE($3, false), COALESCE($4, false))
      ON CONFLICT (user_id) DO UPDATE SET theme=COALESCE($2, account_settings.theme),
      reduce_motion=COALESCE($3, account_settings.reduce_motion), default_review_public=COALESCE($4, account_settings.default_review_public)`,
    [req.userId, body.theme ?? null, body.reduceMotion ?? null, body.defaultReviewPublic ?? null])
    return load(req.userId, client)
  })
  res.json({ settings })
})
module.exports = { router }
