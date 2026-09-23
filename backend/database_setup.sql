-- Dishboxd table setup
-- Not run yet: the database is not connected to the app in Week 1.
-- No seed data here on purpose. Any sample rows added later must be made up, not real people.

CREATE TABLE restaurants (
  restaurant_id     SERIAL PRIMARY KEY,
  google_place_id   TEXT UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  formatted_address TEXT,
  google_photo_url  TEXT,
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE visit_logs (
  visit_log_id   SERIAL PRIMARY KEY,
  restaurant_id  INTEGER NOT NULL REFERENCES restaurants(restaurant_id) ON DELETE CASCADE,
  visit_date     DATE NOT NULL,
  overall_rating NUMERIC(2,1) CHECK (overall_rating BETWEEN 0 AND 5),
  review_text    TEXT,
  total_spent    NUMERIC(10,2) CHECK (total_spent >= 0),
  created_at     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE dishes (
  dish_id        SERIAL PRIMARY KEY,
  visit_log_id   INTEGER NOT NULL REFERENCES visit_logs(visit_log_id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  price          NUMERIC(10,2) CHECK (price >= 0),
  rating         NUMERIC(2,1) CHECK (rating BETWEEN 0 AND 5),
  recommend_flag BOOLEAN DEFAULT FALSE,
  photo_url      TEXT
);
