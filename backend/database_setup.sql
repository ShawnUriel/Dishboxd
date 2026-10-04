-- Dishboxd tables. Run with: npm run db:setup (from the backend folder).
-- Safe to run again: every statement uses IF NOT EXISTS.
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
