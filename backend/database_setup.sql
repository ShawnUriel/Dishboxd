-- Dishboxd tables. Run with: npm run db:setup (from the backend folder).
-- Safe to run again: every statement uses IF NOT EXISTS, or drops and re-adds the same constraint.
--
-- Accounts live in Neon Auth's own schema (neon_auth."user"). Every row here belongs
-- to one of those users, and deleting a user deletes their whole journal (ON DELETE CASCADE).
-- IDs are random UUIDs, so links like /restaurant/<id> cannot be guessed.
-- No seed data: the app starts empty.

-- A restaurant filed by one user. google_place_id is NULL when it was added by hand
-- because it is not on Google Maps. number is the user's own catalog number (R-001, R-002, ...).
CREATE TABLE IF NOT EXISTS restaurants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  number           INTEGER NOT NULL CHECK (number > 0),
  google_place_id  TEXT CHECK (length(google_place_id) <= 300),
  name             TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  address          TEXT NOT NULL DEFAULT '' CHECK (length(address) <= 120),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, number),
  UNIQUE (user_id, google_place_id),  -- the same Google place is filed only once per user
  UNIQUE (id, user_id)                -- lets other tables check a restaurant belongs to the same user
);

-- One visit (one "ticket"). The composite foreign key makes it impossible to log
-- a visit against another user's restaurant.
CREATE TABLE IF NOT EXISTS visit_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  restaurant_id  UUID NOT NULL,
  visit_date     DATE NOT NULL,
  rating         SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  notes          TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (restaurant_id, user_id) REFERENCES restaurants (id, user_id) ON DELETE CASCADE
);

-- The line items on a ticket, in the order they were written.
CREATE TABLE IF NOT EXISTS dishes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_log_id  UUID NOT NULL REFERENCES visit_logs(id) ON DELETE CASCADE,
  position      SMALLINT NOT NULL CHECK (position >= 1),
  name          TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  price         NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (price >= 0 AND price <= 10000),
  UNIQUE (visit_log_id, position)
);

-- A card catalog box (a list of restaurants).
CREATE TABLE IF NOT EXISTS boxes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  title        TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 60),
  description  TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 300),
  is_public    BOOLEAN NOT NULL DEFAULT false,
  color        TEXT NOT NULL CHECK (color IN ('orange', 'mint', 'lavender', 'pink', 'plum')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);

-- Which restaurants are filed in which box. Both foreign keys carry user_id,
-- so a box can only hold restaurants from its own owner.
CREATE TABLE IF NOT EXISTS box_restaurants (
  box_id         UUID NOT NULL,
  restaurant_id  UUID NOT NULL,
  user_id        UUID NOT NULL,
  added_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (box_id, restaurant_id),
  FOREIGN KEY (box_id, user_id) REFERENCES boxes (id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (restaurant_id, user_id) REFERENCES restaurants (id, user_id) ON DELETE CASCADE
);

-- Indexes for the lookups the API makes on every page load
CREATE INDEX IF NOT EXISTS visit_logs_user_date_idx ON visit_logs (user_id, visit_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS visit_logs_restaurant_idx ON visit_logs (restaurant_id);
CREATE INDEX IF NOT EXISTS boxes_user_idx ON boxes (user_id, created_at);
CREATE INDEX IF NOT EXISTS box_restaurants_user_idx ON box_restaurants (user_id);

-- Additive social migration: old reviews stay private.
ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES visit_logs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('avatar', 'review')),
  data BYTEA NOT NULL CHECK (octet_length(data) BETWEEN 4 AND 750000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  handle TEXT NOT NULL UNIQUE CHECK (handle ~ '^[a-z0-9_]{3,30}$'),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 60),
  bio TEXT NOT NULL DEFAULT '' CHECK (length(bio) <= 280),
  avatar_id UUID REFERENCES media(id) ON DELETE SET NULL,
  top_pick_ids UUID[] NOT NULL DEFAULT '{}' CHECK (cardinality(top_pick_ids) <= 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS follows (
  follower_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS follows_following_idx ON follows (following_id, created_at DESC);
CREATE INDEX IF NOT EXISTS media_user_idx ON media (user_id);
CREATE INDEX IF NOT EXISTS media_visit_idx ON media (visit_id);
CREATE INDEX IF NOT EXISTS visits_public_idx ON visit_logs (user_id, created_at DESC) WHERE is_public;

-- Activity inbox. Events are historical: undoing a follow/repost does not erase them.
-- Existing relationships are not backfilled as new notifications.
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  recipient_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('follow', 'repost')),
  visit_id UUID REFERENCES visit_logs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  CHECK (recipient_id <> actor_id),
  CHECK ((kind = 'follow' AND visit_id IS NULL) OR (kind = 'repost' AND visit_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON notifications (recipient_id, id DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications (recipient_id, id) WHERE read_at IS NULL;

-- Additive migration for item reviews, categories, stickers and review reactions.
-- Old dishes keep a NULL score, old restaurants an empty category, and old boxes their colour.

-- Each place has a category (Cafe, Matcha bar, Italian…). Free text, suggested by the app.
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '' CHECK (length(category) <= 40);

-- Cuisine belongs to a ticket: a fusion restaurant can earn different stamps on different visits.
-- NULL preserves the category-based passport behaviour for older tickets; '' explicitly leaves it untagged.
ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS cuisine TEXT CHECK (length(cuisine) <= 40);

-- Every item on a ticket gets its own score out of 10, and its own note. A score can go
-- past 10 (up to 12) for a dish that was that good; the app sets those on fire.
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS score SMALLINT CHECK (score BETWEEN 0 AND 12);
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 500);

-- Box colours: one of the original five names, or any #rrggbb colour chosen in the app.
ALTER TABLE boxes DROP CONSTRAINT IF EXISTS boxes_color_check;
ALTER TABLE boxes ADD CONSTRAINT boxes_color_check
  CHECK (color IN ('orange', 'mint', 'lavender', 'pink', 'plum') OR color ~ '^#[0-9a-f]{6}$');

-- Stickers: small transparent PNGs a user makes from their own images in the browser.
CREATE TABLE IF NOT EXISTS stickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  style TEXT NOT NULL CHECK (style IN ('original', 'pixel', 'vector', 'translucent')),
  data BYTEA NOT NULL CHECK (octet_length(data) BETWEEN 8 AND 400000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);
CREATE INDEX IF NOT EXISTS stickers_user_idx ON stickers (user_id, created_at DESC);

-- Where a sticker is stuck: exactly one profile, review, box or dish, always the placer's own.
-- x and y are percentages of the card, so stickers stay put at any screen width.
CREATE TABLE IF NOT EXISTS sticker_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  sticker_id UUID NOT NULL,
  profile_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  visit_id UUID REFERENCES visit_logs(id) ON DELETE CASCADE,
  box_id UUID,
  dish_id UUID REFERENCES dishes(id) ON DELETE CASCADE,
  x REAL NOT NULL CHECK (x BETWEEN 0 AND 100),
  y REAL NOT NULL CHECK (y BETWEEN 0 AND 100),
  rotation SMALLINT NOT NULL DEFAULT 0 CHECK (rotation BETWEEN -45 AND 45),
  scale REAL NOT NULL DEFAULT 1 CHECK (scale BETWEEN 0.5 AND 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(profile_id, visit_id, box_id, dish_id) = 1),
  CHECK (profile_id IS NULL OR profile_id = user_id),
  FOREIGN KEY (sticker_id, user_id) REFERENCES stickers (id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (box_id, user_id) REFERENCES boxes (id, user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS sticker_placements_sticker_idx ON sticker_placements (sticker_id);
CREATE INDEX IF NOT EXISTS sticker_placements_profile_idx ON sticker_placements (profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sticker_placements_visit_idx ON sticker_placements (visit_id) WHERE visit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sticker_placements_box_idx ON sticker_placements (box_id) WHERE box_id IS NOT NULL;
-- One sticker per dish
CREATE UNIQUE INDEX IF NOT EXISTS sticker_placements_dish_idx ON sticker_placements (dish_id) WHERE dish_id IS NOT NULL;

-- Likes and reposts on reviews. Each diner can like or repost a review once.
CREATE TABLE IF NOT EXISTS review_likes (
  visit_id UUID NOT NULL REFERENCES visit_logs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (visit_id, user_id)
);
CREATE TABLE IF NOT EXISTS review_reposts (
  visit_id UUID NOT NULL REFERENCES visit_logs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (visit_id, user_id)
);
CREATE INDEX IF NOT EXISTS review_reposts_user_idx ON review_reposts (user_id, created_at DESC);

-- A co-review: the author invites one friend, who becomes a second author after accepting.
CREATE TABLE IF NOT EXISTS visit_coauthors (
  visit_id UUID PRIMARY KEY REFERENCES visit_logs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS visit_coauthors_user_idx ON visit_coauthors (user_id, status);

-- Top picks, one per category: the all-time favourite place for "Cafe", "Ramen"… and the dish
-- to order there. Up to eight, in the order the diner arranged them.
CREATE TABLE IF NOT EXISTS top_picks (
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  position SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 8),
  category TEXT NOT NULL CHECK (length(category) BETWEEN 1 AND 40),
  restaurant_id UUID NOT NULL,
  dish TEXT NOT NULL DEFAULT '' CHECK (length(dish) <= 80),
  PRIMARY KEY (user_id, position),
  FOREIGN KEY (restaurant_id, user_id) REFERENCES restaurants (id, user_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS top_picks_category_idx ON top_picks (user_id, lower(category));
-- The earlier top picks (a plain list of up to four places) move over once, each filed under its
-- place's category. The old list is then emptied, so running this file again adds nothing.
INSERT INTO top_picks (user_id, position, category, restaurant_id)
SELECT p.user_id, pick.position, COALESCE(NULLIF(r.category, ''), 'Favourite #' || pick.position), r.id
FROM profiles p
CROSS JOIN LATERAL unnest(p.top_pick_ids) WITH ORDINALITY AS pick(restaurant_id, position)
JOIN restaurants r ON r.id = pick.restaurant_id AND r.user_id = p.user_id
ON CONFLICT DO NOTHING;
UPDATE profiles SET top_pick_ids = '{}' WHERE cardinality(top_pick_ids) > 0;

-- Private places to try, independent of the user's visited restaurant catalog.
CREATE TABLE IF NOT EXISTS bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  place_key TEXT NOT NULL,
  google_place_id TEXT,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  address TEXT NOT NULL DEFAULT '' CHECK (length(address) <= 120),
  category TEXT NOT NULL DEFAULT '' CHECK (length(category) <= 40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, place_key)
);
CREATE INDEX IF NOT EXISTS bookmarks_user_idx ON bookmarks (user_id, created_at DESC);

ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS review_comments (
  id BIGSERIAL PRIMARY KEY,
  visit_id UUID NOT NULL REFERENCES visit_logs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  parent_id BIGINT,
  body TEXT NOT NULL CHECK (length(body) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (id, visit_id),
  FOREIGN KEY (parent_id, visit_id) REFERENCES review_comments(id, visit_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS review_comments_visit_idx ON review_comments (visit_id, id);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  follows BOOLEAN NOT NULL DEFAULT true,
  reposts BOOLEAN NOT NULL DEFAULT true,
  comments BOOLEAN NOT NULL DEFAULT true,
  replies BOOLEAN NOT NULL DEFAULT true,
  digest_frequency TEXT NOT NULL DEFAULT 'off' CHECK (digest_frequency IN ('off', 'daily', 'weekly')),
  digest_since TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('follow', 'repost', 'comment', 'reply'));
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_check1;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_target_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_target_check
  CHECK ((kind = 'follow' AND visit_id IS NULL) OR (kind <> 'follow' AND visit_id IS NOT NULL));
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS comment_id BIGINT REFERENCES review_comments(id) ON DELETE CASCADE;

-- A private home canvas, independent of stickers on the public profile.
ALTER TABLE sticker_placements ADD COLUMN IF NOT EXISTS home_id UUID REFERENCES neon_auth."user"(id) ON DELETE CASCADE;
ALTER TABLE sticker_placements DROP CONSTRAINT IF EXISTS sticker_placements_check;
ALTER TABLE sticker_placements DROP CONSTRAINT IF EXISTS sticker_placements_target_check;
ALTER TABLE sticker_placements ADD CONSTRAINT sticker_placements_target_check
  CHECK (num_nonnulls(profile_id, visit_id, box_id, dish_id, home_id) = 1);
ALTER TABLE sticker_placements DROP CONSTRAINT IF EXISTS sticker_placements_home_owner_check;
ALTER TABLE sticker_placements ADD CONSTRAINT sticker_placements_home_owner_check CHECK (home_id IS NULL OR home_id = user_id);
CREATE INDEX IF NOT EXISTS sticker_placements_home_idx ON sticker_placements (home_id) WHERE home_id IS NOT NULL;

-- Account privacy limits every shared review without rewriting its sharing choice.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS account_settings (
  user_id UUID PRIMARY KEY REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
  reduce_motion BOOLEAN NOT NULL DEFAULT false,
  default_review_public BOOLEAN NOT NULL DEFAULT false
);
