# Dishboxd

[![Made with AI](https://img.shields.io/badge/Made_with-AI_assistance-blue)](AI-USAGE.md)

Built with heavy help from **Claude Code**, which wrote most of the original app, and **Codex**, which implemented profiles, following, photos and the Home/Tray improvements. What they did, where they went wrong and which parts are mine are in [`AI-USAGE.md`](AI-USAGE.md).

## 1. Overview

Dishboxd is a Letterboxd-style food and dining journal. Remember where you ate, what you ordered and how it tasted, with your own photos from each visit. Keep entries private or share selected reviews with other diners, follow their journals and collect your favourite restaurants on your profile.

**Current stage: working journal, item-by-item reviews and a social layer.** Accounts use [Neon Auth](https://neon.com/docs/neon-auth), with verified email or Google sign-in. Entries, uploaded photos, stickers, profiles, follows, likes, reposts and co-reviews persist through Express into Neon Postgres. Every item on a ticket gets its own score out of 10 (past 10 sets the review on fire), restaurants are sorted into categories, prices are in Philippine pesos, and the ticket is filled in on a plate at a dining table. Home combines your journal with Following and Discover feeds, restaurant suggestions and the existing paper/index-card design. Google restaurant search is optional; a new entry can also be filled in directly.

## 2. Setup and installation

### Install first

| Tool | Version | Needed for |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) (includes npm) | 20.19+ or 22.12+ (tested on Node 24.16.0, npm 11.6.2) | Running the frontend and backend |
| [Git](https://git-scm.com/) | Any recent version | Cloning the repository |
| A [Neon](https://neon.com) account (free) | — | Hosts the Postgres database and Neon Auth (the accounts). |
| A [Google Cloud](https://console.cloud.google.com) project with billing turned on | — | Optional. The Google Maps restaurant search. Without it, restaurants are added by hand. |

### Get the code

```bash
git clone https://github.com/ShawnUriel/Dishboxd.git
cd Dishboxd
```

### Install dependencies

The frontend and backend each have their own `package.json`, so install both:

```bash
cd frontend
npm install        # React, React Router, Vite, Tailwind CSS, fonts, Neon Auth
cd ../backend
npm install        # Express, cors, dotenv, pg (Postgres), jose (checks login tokens)
```

### Neon project and Neon Auth

1. Create a free project at [neon.com](https://neon.com).
2. In the project, open **Auth** and enable Neon Auth. It creates a `neon_auth` schema in your database for users and sessions.
3. Turn on required email verification, so new email accounts must enter the emailed code before they can log in. You can do this in the console, or with the [Neon CLI](https://neon.com/docs/reference/neon-cli):

   ```bash
   npm i -g neon
   neon login
   neon link --project-id <your-project-id> --branch production
   neon neon-auth config email-password update --require-email-verification=true --send-verification-email-on-sign-up=true
   neon neon-auth status        # prints your Auth "Base URL"
   ```

Google sign-in works straight away with Neon's shared development keys. Verification emails come from Neon's shared sender. Both are meant for development (see section 7).

### Google Places API (restaurant search)

Optional: the app runs without it, and the search then says "Google restaurant search is not set up yet" and offers only the add-it-yourself card.

1. In the [Google Cloud console](https://console.cloud.google.com), create a project and link a billing account. Google requires one even for the free allowance.
2. Under **APIs & Services → Library**, enable **Places API (New)**.
3. Under **APIs & Services → Credentials**, create an API key. Edit it and, under **API restrictions**, allow only **Places API (New)**.
4. Under **Billing → Budgets & alerts**, set a small budget alert. Under the API's **Quotas**, you can also cap the autocomplete requests per day.
5. Put the key in `backend/.env` as `GOOGLE_PLACES_API_KEY`, then restart the backend.

Search uses Autocomplete requests; visible Google thumbnails also use Place Details and Place Photos. These are subject to [Google Maps Platform pricing](https://developers.google.com/maps/billing-and-pricing/pricing). The app waits until you stop typing before searching and fetches Google photos only as their cards enter the viewport. Each user can make up to 30 searches and 30 photo lookups per minute.

### Environment and configuration

Both halves read settings from a `.env` file. Copy each example file and fill in your own values:

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

`.env` files are gitignored, so never commit real credentials. Only the `.env.example` files (placeholders) are in the repository.

**Frontend** (`frontend/.env`), required:

| Variable | Example value | What it does |
| --- | --- | --- |
| `VITE_NEON_AUTH_URL` | `https://<endpoint>.neonauth.<region>.aws.neon.tech/neondb/auth` | Your Neon Auth Base URL (from the console or `neon neon-auth status`). It is public, not a secret. |
| `VITE_API_URL` | `http://localhost:5000` | Where the Express API runs during local development (the default). Leave it out on Vercel: production builds call `/api` on the same site. |

**Backend** (`backend/.env`), required unless a default is given:

| Variable | Example value | What it does |
| --- | --- | --- |
| `PORT` | `5000` | Port the Express server listens on. Defaults to `5000`. |
| `CLIENT_ORIGIN` | `http://localhost:5173` | The only website allowed to call the API from a browser (CORS). Defaults to `http://localhost:5173`; on Vercel, set it to the site's address. |
| `DATABASE_URL` | `postgresql://user:password@host/neondb?sslmode=verify-full` | Your Neon connection string (Connect button in the console, or `neon connection-string`). **Secret.** |
| `NEON_AUTH_URL` | same as `VITE_NEON_AUTH_URL` | Used to check login tokens against Neon Auth's public keys. Not a secret. |
| `GOOGLE_PLACES_API_KEY` | `your_api_key_here` | Google Places API (New) key for the restaurant search. Optional: while it is missing or still the placeholder, search is limited to restaurants on file and ones you add by hand. **Secret**: it is only used by the backend and never reaches the browser. |
| `GOOGLE_PLACES_REGION` | `ph` | Two-letter country code. Google only suggests places in that country. Leave empty to search everywhere. |

### Database setup

Neon Auth's own tables (`neon_auth.user`, `neon_auth.session` and so on) are created when you enable Neon Auth. Create or upgrade Dishboxd's tables from the backend folder:

```bash
cd backend
npm run db:setup
```

It runs `backend/database_setup.sql` in a transaction and is safe to run again. **Run this before deploying an upgrade**, because the new code reads the new columns and tables. Upgrades are additive and keep existing data: the profile/photo upgrade added three tables and a sharing flag (existing visits stay private); the item-review upgrade adds a score and note to each dish (old dishes stay unscored), a category to each restaurant (empty until sorted), allows any colour for boxes, and adds five tables for stickers, likes, reposts and co-authors. The top-picks upgrade adds a `top_picks` table and moves each earlier pick into it, filed under its place's category (uncategorised ones become "Favourite #1", "Favourite #2"…). The fourteen tables:

| Table | Holds |
| --- | --- |
| `restaurants` | A restaurant a user filed: catalog number (R-001…), name, address, category (Cafe, Matcha bar…; empty until sorted), and `google_place_id`, which is empty for places added by hand. |
| `visit_logs` | One visit (ticket): restaurant, date, 1–5 overall rating, notes and an explicit sharing flag (private by default). |
| `dishes` | The items on a ticket, in order, each with its price in pesos, its own score (0–12, where 10 is perfect and past 10 is "on fire") and a note. |
| `boxes` | A user's card catalog boxes: title, description, colour (one of five names or any `#rrggbb`), public or private. |
| `box_restaurants` | Which restaurants are filed in which box. |
| `profiles` | Unique username, display name, bio and avatar reference. (Its old `top_pick_ids` list is emptied once moved to `top_picks`.) |
| `top_picks` | Up to eight top picks per diner, one per category: the category, the restaurant (one of their own) and its must-order dish, in the diner's order. |
| `follows` | Follower/following relationships; duplicate follows and self-follows are prevented. |
| `media` | Compressed JPEG bytes and ownership, attached to a profile or review. |
| `stickers` | A user's sticker book: small transparent PNGs made in the browser, with the style used (just the image, pixelated, vector or translucent). |
| `sticker_placements` | Where a sticker is stuck: exactly one of the user's own profile, reviews, boxes or dishes, with position, tilt and size. |
| `review_likes` | Which diner liked which review, once each. |
| `review_reposts` | Which diner reposted which review to their followers, once each. |
| `visit_coauthors` | The one friend invited to co-author a review, pending until they accept. |

Journal records and profiles belong to Neon Auth users, and account deletion cascades through their data. Composite foreign keys prevent visits and box entries from mixing users' restaurants, and stop anyone from placing another user's sticker or decorating another user's box. The API checks ownership before attaching a photo or a sticker. UUIDs identify records; authorization checks protect private data.

There is no seed data: the app and the database both start empty.

## 3. How to run it

Start the backend and the frontend in **two separate terminals**. The app saves everything through the backend, so both must be running.

**Terminal 1 — backend**

```bash
cd backend
node server.js      # or: npm start
```

Expected output:

```
Server running on port 5000
```

To check it, open <http://localhost:5000/api/test>. You should see:

```json
{"message":"Dishboxd backend is working!"}
```

**Terminal 2 — frontend**

```bash
cd frontend
npm run dev
```

Vite prints a local address, usually <http://localhost:5173>. Open it in your browser.

**What you should see:** a ticket-style login card on ruled notebook paper. After signing in, **The Log** has a welcome card, journal statistics, recent reviews and suggestions, with `HOME`, `SEARCH`, `TRAY`, `FRIENDS` and `PROFILE` tabs. A new journal starts empty and offers **NEW ENTRY**. On a phone the tabs become a bottom bar. Cards use subtle entrance and hover animations, with reduced-motion preferences respected.

To stop either server, press `Ctrl + C` in its terminal.

### Deploying to Vercel

Dishboxd deploys as **one Vercel project with two services**, set up in the root `vercel.json`. The `frontend` service serves the React app and the `backend` service runs the Express API. They share one address: every path under `/api/` goes to the backend and every other path goes to the frontend, so the browser calls the API on the same site.

1. In Vercel, choose **Add New → Project** and import the repository. Leave the Root Directory as the repository root; Vercel reads `vercel.json`.
2. Add the environment variables, which both services share: `DATABASE_URL`, `NEON_AUTH_URL`, `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACES_REGION`, `VITE_NEON_AUTH_URL`, and `CLIENT_ORIGIN` set to the site's address. Do not set `VITE_API_URL`: production builds call `/api` on the same site.
3. Run `npm run db:setup` from the backend against the deployment database before deploying new schema changes (including this item-review upgrade). Deploy, then add the site's address to Neon Auth's trusted domains (`neon neon-auth domain add …`), or login and Google sign-in will not work there.

Only variables whose names start with `VITE_` are built into the browser code, so the secrets stay on the server even though both services can see them.

## 4. Features and usage

Every journal page needs you to be logged in. The journal starts empty, and everything you add (restaurants, visits, boxes, stickers) is saved to the database straight away. If saving fails (for example, the backend is not running), the page says so and keeps what you typed.

### Accounts (Neon Auth)

- **Sign up with email** (`/signup`): enter your name, email and a password of at least 8 characters. Neon Auth emails you a code, and on **Check your email** (`/verify-email`) you type it in. The account only works after the code is confirmed, which proves the email is real and yours. A correct code also logs you in. **Send a new code** works every 30 seconds.
- **Log in** (`/login`): email and password. A wrong email or password shows "Wrong email or password." If you sign up but never confirm the code, logging in sends you a fresh code and takes you back to **Check your email**.
- **Continue with Google** (on both pages): signs you up the first time and logs you in after that. Google has already confirmed the email, so no code is needed.
- **Log out**: the link under the title on **The Log**.
- Each account owns its journal. Other signed-in diners can see only reviews explicitly shared by their author. Switching accounts clears the previous user's journal from memory.

### Primary flow: log a visit

1. On **The Log** (`/`), click **+ NEW ENTRY**.
2. The **Dishboxd Ticket** (`/log/new`) opens immediately, lying on a plate on a gingham tablecloth (with a napkin and cutlery on wide screens). Enter the restaurant name and optional address (if it is already in your journal, **Use it** files the visit under that place; **+ NEW ENTRY** on a restaurant page does the same), and pick a **category** with one tap (Cafe, Matcha bar, Italian…) or type your own. Typing the restaurant name searches as you go: places already in your journal come first, then Google Maps places to eat with a photo and their photo credit (arrow keys and Enter work too). Choosing a Google place fills in its name, address and a suggested category, and its photo appears across the top of the ticket with its credits; when Google has no photo, the ticket looks as before. A name that matches nothing is kept as typed, for places not on Google Maps. Changing the name after choosing a Google place turns it into a place added by hand.
3. Choose the visit date and overall star rating. Each item you ordered gets its own container: its name, price in pesos, **its own score out of 10**, a note ("Silky, not too sweet"), and optionally one sticker you can drag anywhere on it. Write your review and upload up to three photos from that visit. **Ate with a friend?** invites one friend to co-author the review. Leave **Share on my profile** unchecked for a private entry, or check it to share the review, items, notes and photos with signed-in diners. Click **STAMP & SUBMIT**. Validation keeps the form available if something needs fixing. At a previously visited restaurant, dish suggestions come from your own past tickets.
4. You land on the restaurant's profile (`/restaurant/:id`), with the new visit in **Visit history**. Its **+ NEW ENTRY** stamp logs another visit at the same restaurant. A restaurant found through Google has a **Menu & info on Google Maps** link, which opens its Google Maps page (menu, photos and opening hours, when the restaurant has them) in a new tab.
5. Click **+ FILE IN A BOX** to add the restaurant to a box. Make boxes first in the **TRAY** tab (`/lists`) with **New box**.

### Item scores, and going past 10

Use **−** / **+** or the slider to score an item from 0 to 10; a word appears with it ("Pretty good", "Perfect"). Something unforgettable can go past 10: **11/10** ("Off the charts") and **12/10** ("Legendary") are the top. Any item past 10 sets the whole review on fire: flat, illustrated flames in red, orange, yellow and salmon burn along the bottom of the card with sparks rising, the card casts a flickering red fire shadow underneath, and the score badge burns (a taller fire for 12/10). The item's container on the ticket catches fire as you score it. Flames respect reduced-motion preferences. Scores are optional; the 1–5 star overall rating stays.

### Categories

Every restaurant can belong to one category, chosen on the ticket or changed later on its page (**Change** under the name). Common ones are one tap away and any short name works. Home's **By category** card and the **On file by category** chips in Search show your places grouped by category, with **Not sorted yet** for older ones; diners' reviewed restaurants can be filtered by category on their profile. Categories appear as small tags on review cards, search results and open boxes.

### The Tray and card catalog

The **TRAY** tab (`/lists`) organizes your saved restaurants into coloured folders with layered index cards, restaurant previews and collection counts. Search by box name or a restaurant inside it, filter to filled or empty boxes, and sort by newest, name or restaurant count. **New box** opens a named collection form with suggestions; creating or cancelling returns focus to the main button.

Open a box to see its restaurants as photo cards, plus visit counts, average meal ratings and last-visit dates. The header matches the folder's colour, and **Back to your tray** returns to the collection. **Edit box** changes its name, its description (up to 300 characters, shown on the folder in the Tray) and its colour: the five originals, seven more swatches, or **Any colour** from a colour picker. Dark colours switch to white text automatically. **Stickers** decorates the box; its stickers also show on its folder in the Tray. Empty boxes explain how to file a restaurant; existing filing controls on restaurant pages save directly to Postgres. Folder motion respects reduced-motion preferences, and both pages adapt to phone widths.

### Search photos

Search cards show your latest uploaded review photo for restaurants already in your journal. When no review photo is available and a Google place ID exists, the card fetches a Google place photo. Photographer credits and source links appear below it. The server keeps the API key private and retrieves fresh photo references; Google photo URLs and references are not saved to the database. See the [Place Photos documentation](https://developers.google.com/maps/documentation/places/web-service/place-photos).

Listings without a photo get a clear placeholder. A failed lookup offers **Retry photo**, while the restaurant can still be selected. Manually added places without a Google ID can use photos uploaded with a review.

### Stickers

Make stickers from any picture (JPEG, PNG, WebP or GIF up to 12 MB) in the sticker maker, which opens from any **Stickers**, **Decorate** or **Add a sticker** button. Choose a style: **Just the image**, **Pixelated** (chunky 8-bit pixels), **Vector** (a few flat colours, like an illustration) or **Translucent** (see-through, like clear vinyl). **Cut out a plain background** removes a plain backdrop, including holes like the middle of a donut, and **White sticker edge** adds a die-cut border. The preview updates as you change options. Everything is processed in the browser; only the finished sticker, a small PNG, is uploaded.

Stick them on your profile card, your review cards, your boxes and each item on a ticket. Drag a sticker to move it; tap it for tilt, size and **Peel off** buttons. With a keyboard: arrows move it, `[` and `]` tilt, `-` and `+` resize, and Delete peels it off. A sticker book holds 60 stickers of up to 400 KB each, and each card up to twelve (one per item). Deleting a sticker from the book (**Manage**) peels it off everywhere. Others see a sticker only where they can see the card: profiles are visible to members, reviews follow their sharing, and boxes stay private.

### Profiles, friends and following

Use the **PROFILE** tab to upload an avatar and edit your display name, unique username and bio (up to 280 characters). **Top picks** are your all-time favourites, one per category, each with its must-order dish: for example **Cafe** → Caution → Spanish Latte. On your profile, **+ Choose your top picks** (or **Edit top picks**) opens an editor. Choose a restaurant and its category and best-scored dish fill in. **Suggest from my reviews** proposes your best-rated place for every category you have reviewed. Rows can be reordered or removed, up to eight. Only places you have shared a review of can be picked, so a top pick never reveals a private visit. Everyone who opens your profile sees them as **Best in …** cards. Your profile includes recent reviews, reviewed restaurants, and follower/following counts that open their member lists. Your own recent-review tab also shows your private entries, labelled as private; other diners see shared entries only.

The **FRIENDS** tab (`/friends`) gathers your people. **Friends** follow each other; **Follow back** lists diners who follow you; **Following** lists those who have not followed back yet; **Find diners** searches the directory by display name or username. Profiles and person cards show a **Friends** or **Follows you** badge. Home opens on **For you**, a feed like a "for you" page: shared reviews written or co-written by diners you follow, the reviews they reposted, and your own reposts. Each review shows once, at its latest post or repost, credited to everyone who reposted it ("You and Bea Santos reposted"), newest first, 20 at a time with **Load more**. **Yours** is your own journal; **Discover** shows shared reviews from other diners. Review cards in your own profile can be shared or made private later. Making a review private also removes its photos from other diners' access and updates the public restaurant summary.

On a shared review, **♥** likes it (once per diner) and **↻** reposts it to your followers; your reposts are listed on your profile's **Reposts** tab. **Share** opens the phone's share sheet, or copies the review's link (`/review/:id`), which opens for signed-in diners.

**Co-reviews:** invite one friend to co-author a review, from the ticket or later from the review card. The invite appears on their Friends page (and on the review), where they **Accept** or **Decline**. Once accepted, both names and avatars head the review, and it appears on both profiles. The invited friend can read the review even if it is private, so they can decide. The author can cancel the invite or remove the co-author, and the co-author can leave.

### Photo uploads

The uploader accepts JPEG, PNG and WebP files up to 12 MB, resizes them and converts them into JPEGs below the server's 750 KB limit. Review photos are limited to three per entry and accounts to 30 MB of stored photos. Avatars are resized separately; uploading a replacement removes the old avatar. Photos are stored in Postgres for this course project, so no separate storage account is needed. Private and unfinished review uploads are readable only by their owner; shared review photos and avatars require a signed-in viewer. Unattached uploads older than a day are cleaned up on the next upload.

### Pages

| Route | Page | What it shows |
| --- | --- | --- |
| `/login` | Log in | Email and password, or **Continue with Google** |
| `/signup` | Sign up | Name, email and password, or **Continue with Google** |
| `/verify-email` | Check your email | Enter the emailed code; **Send a new code** |
| `/` | The Log | Welcome card, statistics, For you/Yours/Discover review feeds, suggestions and **NEW ENTRY** |
| `/search` | Card Catalog | Matching journal/Google restaurants with category tags, **On file by category** chips, real photos with credits, and a NEW card to add a restaurant yourself |
| `/log/new` | Dishboxd Ticket | On a plate at the table: Google photo (when available), restaurant fields, category, visit date, rating, one container per item (price, score, note, sticker), review, photos, co-author invite and optional sharing |
| `/profile` | My profile | Editable name, username, bio, avatar, top picks and stickers (**Decorate**); reviews (incl. accepted co-reviews), reposts, restaurants and connections |
| `/profile/:id` | Diner profile | Shared reviews and co-reviews, reposts, reviewed restaurants by category, top picks, follower/following lists and a follow button |
| `/friends` | Friends | Friends, follow-backs, following, the diner directory and co-review invites |
| `/people` | (redirect) | Opens **Find diners** on the Friends page |
| `/review/:id` | One review | A single review, where shared links land, with likes, reposts and co-review controls |
| `/restaurant/:id` | Restaurant profile | Photo, catalog number, category (**Change**), average rating, **Menu & info on Google Maps** (Google places only), top dishes with average scores, visit history with item scores, **+ FILE IN A BOX**, **+ NEW ENTRY** |
| `/lists` | The Card Catalog | Layered folder cards in each box's colour, with descriptions and stickers, collection counts, search/filter/sort controls and **New box** |
| `/lists/:id` | Box open | Colour-matched folder header with **Edit box** (name, description, colour) and **Stickers**, visit/rating statistics and restaurant photo cards |
| anything else | Nothing on file | A not-found page with a link home |

### Design system

- **Stack:** Tailwind CSS v4. All design tokens (colours, fonts, paper textures) are in `frontend/src/index.css` under `@theme`.
- **Colours:** brand red `#8c2f2f`, slate blue `#4e6887`, orange `#ffa25c`, on cream paper `#fffef8`. Every text colour was checked against WCAG AA (4.5:1). The grey and blue from the mockups were darkened slightly to pass, and the orange tab and light-coloured boxes use dark text instead of white.
- **Type:** Fraunces (headings and restaurant names) and IBM Plex Mono (everything else), self-hosted through Fontsource.
- **Components:** built in atomic layers in `frontend/src/components/` (`atoms/`, `molecules/`, `organisms/`), following my wireframe component tree.
- **Responsive:** below 768px the side tabs become a bottom tab bar, and the restaurant profile's two columns stack into one.
- **Motion:** subtle card entrances and hover movement; disabled when the viewer prefers reduced motion. Keyboard focus remains visible.
- **Fire:** reviews and ticket items past 10 get layered SVG flames (`Flames.jsx`), drawn behind the card's text, a flickering red fire shadow underneath (`.on-fire` and its `::after` in `index.css`) and burning score badges (`.score-fire`); everything holds still when motion is reduced.
- **Table setting:** the ticket's gingham tablecloth, plate, napkin and cutlery are drawn with CSS and inline SVG (`TableSetting.jsx`, `.dining-table`/`.plate` in `index.css`); the napkin and cutlery appear only when the screen is wide enough to show them beside the plate.
- **Friends tab:** lavender with dark text, like the other light tabs.

### API endpoints

Every route except `/api/test` needs a login: send the Neon Auth token as `Authorization: Bearer <token>` (the React app does this for you). The server checks its signature against Neon Auth's public keys. Journal writes are restricted to their owner; social reads expose profiles and explicitly shared reviews. All user input is passed through parameterized queries.

| Method | Path | Body | What it does | Success |
| --- | --- | --- | --- | --- |
| `GET` | `/api/test` | | Proves the server is running. No login needed. | `200` |
| `GET` | `/api/restaurants` | | The user's restaurants, by catalog number, with categories | `200` |
| `PATCH` | `/api/restaurants/:id` | `{ category }` | Sorts one of the user's restaurants into a category (empty clears it) | `200` `{ restaurant }` |
| `GET` | `/api/visits` | | The user's visits, newest first, each with its items (score, note, sticker), photos, stickers, likes, reposts and co-author | `200` |
| `POST` | `/api/visits` | `{ restaurantId }` **or** `{ place: { placeId, name, address } }`, plus `{ date, rating, notes, dishes, category, isPublic, photoIds, coauthorId }`; each dish `{ name, price, score, description, sticker }` | Atomically saves a ticket, its items (score 0–12, note up to 500 characters, one owned sticker each), up to three owned photo references, the place's category, and an optional co-author invite (friends only). `isPublic` defaults to false. Any problem saves nothing. | `201` `{ restaurant, visit }` |
| `PATCH` | `/api/visits/:id` | `{ isPublic }` | Shares or makes private one of the user's reviews | `200` |
| `GET` / `PATCH` | `/api/profiles/me` | For PATCH: `{ name, handle, bio }` | Loads or updates the user's profile | `200` |
| `PUT` | `/api/profiles/me/top-picks` | `{ picks: [{ category, restaurantId, dish }] }` | Replaces the user's top picks, in order: up to eight, one per category (case-insensitive), each a restaurant with a shared review | `200` `{ topPicks }` |
| `GET` | `/api/profiles?q=...` | | Searches diner names and usernames | `200` |
| `GET` | `/api/profiles/:id` | | Profile, reviews and accepted co-reviews you can see, reposts, reviewed restaurants, top picks and the stickers on the profile | `200` |
| `GET` | `/api/profiles/friends` | | `{ friends, followBack, following }`: friends follow each other | `200` |
| `GET` | `/api/profiles/:id/connections?type=followers` | | Follower list; use `type=following` for following | `200` |
| `PUT` / `DELETE` | `/api/profiles/:id/follow` | | Follows/unfollows a diner idempotently | `200` |
| `GET` | `/api/profiles/feed?scope=foryou` | | Home's feed: shared reviews written or co-written by diners you follow, their reposts and your own reposts, once each at their latest activity, with `reposters` and `activityAt`. `scope=following` leaves out your own reposts; `scope=discover` shows other diners' shared reviews. 20 per page; `&before=<activityAt>` gives the next page | `200` |
| `GET` | `/api/reviews/:id` | | One review the user may see (shared, theirs, or one they were invited to co-author) | `200` `{ review }` |
| `PUT` / `DELETE` | `/api/reviews/:id/like` | | Likes or unlikes a review the user can see, idempotently | `200` `{ likeCount, liked, repostCount, reposted }` |
| `PUT` / `DELETE` | `/api/reviews/:id/repost` | | Reposts or un-reposts someone else's shared review | `200` (same counts) |
| `PUT` | `/api/reviews/:id/coauthor` | `{ userId }` | The author invites a friend to co-author (replaces a pending invite) | `200` `{ review }` |
| `POST` | `/api/reviews/:id/coauthor/accept` | | The invited friend accepts | `200` `{ review }` |
| `DELETE` | `/api/reviews/:id/coauthor` | | The author removes the co-author, or the friend declines or leaves | `200` |
| `GET` | `/api/reviews/invites` | | Co-review invites waiting for the user's answer | `200` `{ invites }` |
| `POST` | `/api/media` | Raw JPEG, `Content-Type: image/jpeg` | Uploads an owned photo to attach when submitting a review | `201` `{ id }` |
| `PUT` | `/api/media/avatar` | Raw JPEG | Replaces the user's profile avatar | `200` `{ id }` |
| `GET` / `DELETE` | `/api/media/:id` | | Reads a permitted photo or deletes an owned one | `200` |
| `GET` | `/api/boxes` | | The user's boxes, each with its `restaurantIds` and stickers | `200` |
| `POST` | `/api/boxes` | `{ title }` | Makes an empty box (colours rotate) | `201` `{ box }` |
| `PATCH` | `/api/boxes/:id` | `{ title?, description?, color? }` | Renames, describes or recolours a box; `color` is one of the five names or `#rrggbb` | `200` `{ box }` |
| `GET` | `/api/stickers` | | The user's sticker book, newest first | `200` `{ stickers }` |
| `POST` | `/api/stickers?style=pixel` | Raw PNG, `Content-Type: image/png` | Adds a sticker (`style`: `original`, `pixel`, `vector` or `translucent`); up to 60 per user | `201` `{ sticker }` |
| `GET` / `DELETE` | `/api/stickers/:id/image`, `/api/stickers/:id` | | Reads a sticker the user may see, or deletes an owned one (peeling it off every card) | `200` |
| `POST` | `/api/stickers/placements` | `{ stickerId, target: { type, id }, x, y, rotation, scale }` | Sticks an owned sticker on the user's own `profile`, `visit`, `box` or `dish` (x/y are 0–100 % of the card, tilt −45–45°, size 0.5–2) | `201` `{ placement }` |
| `PATCH` / `DELETE` | `/api/stickers/placements/:id` | For PATCH: any of `{ x, y, rotation, scale }` | Moves, tilts, resizes or peels off one of the user's stickers | `200` |
| `POST` | `/api/boxes/:id/restaurants` | `{ restaurantId }` | Files a restaurant in a box | `201`, or `200` if it was already there |
| `GET` | `/api/places/autocomplete?q=jollibee` | | Asks Google Places for up to five places to eat matching `q` (2–100 characters). The backend adds the API key, so the browser never sees it. At most 30 searches a minute per user. | `200` `{ places: [{ placeId, name, address, category }] }` (`category` is a suggestion from Google's place types) |
| `GET` | `/api/places/:placeId/photo` | | Fresh Google photo lookup, up to 30 per user per minute; `?size=large` asks for the wider image used on the ticket. Returns safe public image/source links and author credits; never the API key or photo resource name. | `200` `{ photo: null }` or `{ photo: { url, sourceUrl, attributions } }` |

**Errors** are always JSON like `{"error":"Rating must be a whole number from 1 to 5."}`:

| Status | When |
| --- | --- |
| `400` | Invalid input (rating not 1–5, an item score that is not a whole number from 0 to 12, no dishes or more than 20, blank names, price outside ₱0–10,000, a future or impossible date, an over-long text, a box colour that is not a preset or `#rrggbb`, a sticker position out of range, a co-author who is not a friend, more stickers than allowed), or a body that is not valid JSON |
| `401` | No login token, or an expired or tampered one |
| `404` | The restaurant, box, sticker or review does not exist **or belongs to someone else / is private** (the API never reveals which), or an unknown path |
| `409` | A profile username is already taken, or a review already has an accepted co-author |
| `413` | JSON body over 64 KB, a JPEG upload over 750 KB or a sticker over 400 KB |
| `429` | More than 30 Google searches or photo lookups a minute, or 30 photo uploads in ten minutes. `Retry-After` says how long to wait. |
| `500` | Anything unexpected. Details are logged in the backend terminal only, never sent to the browser. |
| `502` | Google did not answer or returned an error (Google's message is logged in the backend terminal only) |
| `503` | `GOOGLE_PLACES_API_KEY` is not set, so Google search is off |

### Not built yet

Sharing a public box by link, editing a saved review's text/date/items (item stickers can be changed), deleting visits and boxes, and notifications for likes, reposts and invites. Review visibility, box names/descriptions/colours, categories and stickers can already be changed.

### Verification

```bash
cd frontend
npm run lint
npm run build
cd ../backend
npm test
```

Backend integration tests use real Postgres in a temporary schema and fixture authentication. Set `TEST_DATABASE_URL`, or configure `backend/.env`; the database role must be allowed to create schemas. The harness removes the temporary schema afterwards and does not modify real accounts or journals. Tests cover private/public review access, photo ownership, transactional saves, follows, profile validation, avatars and repeatable migrations, plus item scores and notes (including the 0–12 range), categories, box editing, sticker ownership and visibility, likes, reposts, friends and co-reviews (`test/features.test.js`). Separate Google-photo tests stub the upstream service to check authentication, timeouts, missing photos, attribution, unsafe links and key nonexposure without billed requests. Run only those with `node --test test/places.test.js` from `backend`. These tests do not test Neon signup or login.

For an isolated browser preview, run `node test/browser-preview.cjs` from `backend` and open `http://127.0.0.1:5173`. It uses real API routes and a temporary database schema with local fixture accounts; production authentication remains unchanged. Type `stop` in its terminal to clean up. Browser checks covered profile editing, avatar/review uploads, top picks, following, reload persistence and mobile layouts; for the item-review upgrade they also covered the ticket on its plate with a Google photo, item containers with scores and fire, making and placing stickers, box editing, the Friends page, invites, likes and reposts, at desktop and phone widths.

## 5. Project structure

```
Dishboxd/
├── README.md                    Project documentation (this file)
├── AI-USAGE.md                  Log of how AI tools were used in this build
├── vercel.json                  Vercel services: /api/* goes to the backend, everything else to the frontend
├── .gitignore                   Keeps .env, node_modules and build output out of git
├── frontend/                    React app (Vite)
│   ├── index.html               Page shell that loads the React app
│   ├── .env.example             Placeholders for VITE_NEON_AUTH_URL and VITE_API_URL
│   └── src/
│       ├── main.jsx             Entry point; loads fonts and styles, mounts <App />
│       ├── App.jsx              Routes: log-in pages, and the journal pages behind the login check
│       ├── index.css            Design tokens (@theme) and paper textures
│       ├── components/
│       │   ├── atoms/           Button, TextField, RatingCircle, StarRating, Stamp, Tag, Flames, ScoreBadge, CategoryTag,
│       │   │                    StickerImage, TableSetting, ...
│       │   ├── molecules/       GoogleButton, VisitLogCard, SearchResultItem, ManualPlaceForm, DishCard, ScoreInput, CategoryField, ReviewCard,
│       │   │                    ReviewActions, CoauthorControls, CoauthorPicker, StickerLayer, StickerTray, StickerMaker, BoxColorPicker,
│       │   │                    TicketPlacePhoto, ListCard, PersonCard, RestaurantCard
│       │   └── organisms/       AuthGate (login check), AuthCard, Navbar, VisitLogFeed, SearchAutocomplete, DishEntryList, RestaurantHeader, ListGrid
│       ├── pages/               Account pages, Home, Search, VisitForm, RestaurantProfile, Profile, Friends, ReviewPage, Lists, ListDetail, NotFound
│       ├── state/               JournalProvider + useJournal: restaurants, visits, boxes and the sticker book in memory (starts empty, one per account)
│       └── lib/                 auth.js, api.js (calls the backend with the login token), formatting (pesos), stats, scores, categories, colors,
│                                stickers (in-browser sticker making), share, and hooks for sticker placements and Google place photos
└── backend/                     Express API
    ├── server.js                Server setup, CORS, routes, error handling
    ├── auth.js                  requireUser: checks the Neon Auth token on every journal route
    ├── validate.js              Server-side input checks (text, numbers, prices, dates, ids)
    ├── db.js                    Postgres connection pool and a transaction helper
    ├── rateLimit.js             perUserLimit: caps how often one user can call a route (used on Google search)
    ├── routes/                  restaurants.js, visits.js, boxes.js, places.js, profiles.js, media.js, stickers.js, reviews.js
    ├── social.js                Profile/review query columns, visibility rules and response formatting
    ├── test/                    Isolated Postgres integration checks and browser preview
    ├── database_setup.sql       CREATE TABLE commands (run with npm run db:setup)
    ├── setup-db.js              Runs database_setup.sql against DATABASE_URL
    └── .env.example             Placeholder environment variables
```

## 6. Screenshots

Screenshots are kept in my private course workspace and embedded in `project/Documentation/Documentation.md` there:

- **Styled UI (2026-09-27), in `project/Documentation/ui-screenshots/`:** the empty starting Log, then each screen after adding entries through the forms: Card Catalog with the "add it yourself" card, the ticket, a restaurant profile, the Log, the boxes, and an open box. Also the search, ticket and restaurant profile at phone width.
- **Week 1 skeleton (2026-09-23), in `project/Documentation/`:** the unstyled placeholder pages, the `GET /api/test` response, and the security-check evidence.

## 7. Known issues and next steps

The app is deployed to Vercel. Accounts, journal forms, profiles, follows and photo uploads save to Neon Postgres.

**Known issues**

- **Development-only sign-in settings.** Google sign-in uses Neon's shared keys, so Google's consent screen shows Neon's name and logo. Verification emails come from Neon's shared sender (`auth@mail.myneon.app`). Before launch: my own Google OAuth keys, my own email provider, and my site's address added to Neon Auth's trusted domains.
- **Neon Auth's JavaScript package is a beta** (`@neondatabase/auth` 0.5), so its API may change. It also makes the app bundle about 630 KB, which Vite warns about.
- **No "forgot password" page yet.**
- **Google search misses some places.** Google sends at most five suggestions per search, and Dishboxd hides the ones that are not places to eat (in testing, "SM City Clark" and "Holy Angel University" were hidden correctly). A restaurant that Google files only as a generic "establishment" is hidden too; one Mang Inasal branch was. Google also may not know a name the way you type it ("Starbucks Marquee Mall" found nothing). In those cases the restaurant can still be added by hand.
- **Search leans toward Angeles City.** Without a location, Google favours places near the computer that asks, which would be the hosting company's data centre once deployed. So every search leans toward a 5 km circle around Angeles City (`SEARCH_AREA` in `backend/routes/places.js`). It is a bias, not a limit: places farther away still show up when their name matches, but someone searching from another city gets Angeles branches first.
- **No menus from Google.** The Places API does not return menus or dishes, so a Google place links to its Google Maps page instead, and dish suggestions come only from your own past tickets.
- **Photo availability depends on the source.** Search uses Google photos where available and your own review photos for saved restaurants. Manually added places need a review upload; Google errors show a retry action. Restaurant records and Tray photo cards use your own review uploads.
- **No edit or delete** for saved review text/items or for boxes. Review sharing, box names/descriptions/colours, categories and stickers can be changed; boxes remain private.
- **Stickers live in Postgres**, like photos: up to 60 per user at 400 KB each. Background cut-out works on plain backdrops; busy photos are kept whole (the preview shows the result before saving).
- **Co-reviews have one co-author**, who must be a friend (both follow each other) and accept first. Shared review links open only for signed-in diners.
- **Scores past 10 stop at 12.** Prices are pesos, up to ₱10,000 per item.
- **Rate limits use server memory.** Google searches and photo uploads are limited per user, but their counters reset on restart and are not shared between Vercel instances. Other journal routes have no rate limit.
- **Social lists are bounded.** Feeds/recent reviews show the latest 20 entries, reviewed restaurants up to 100, and each connection list up to 100. Pagination is a future improvement.
- **The app's database role owns the tables.** It connects as Neon's default owner role rather than a role with only the permissions it needs (security checklist row 15).
- **The third tab says "TRAY"**, but my mockups call it "TRAY" on some screens and "BOXES" on others. I picked TRAY for now.

**Next steps**

1. Use the user's own location for Google searches (if they allow it) instead of always Angeles City.
2. Edit and delete routes (`PATCH`/`DELETE`) for visits and boxes, and a public link for public boxes.
3. Add pagination and move photos to dedicated object storage if the project grows beyond the course demo. Before a real launch: my own Google OAuth keys and email provider.

## Security checklist

The completed security checklist is kept in my private course workspace at `project/SECURITY-CHECKLIST.md`, as the course asks, with its evidence screenshots next to it. Every row is answered Yes, No or N/A with evidence.

## AI usage

Claude Code (Anthropic's AI coding assistant) wrote most of the code in this project, and an AI chat tool helped me debug CORS in Week 1. What I asked for, what I kept or changed, where the AI got it wrong, and which code is mine are logged in [`AI-USAGE.md`](AI-USAGE.md).

**Credit:** Claude Code generated most of the original frontend and backend, and the item-by-item reviews, categories, peso prices, fire effect, table setting, stickers, editable boxes, Friends page, likes, reposts and co-reviews. Codex implemented diner profiles, following, review/search photos and the Home/Tray redesigns, and ran the associated verification. I directed the features, manually set up external APIs and deployment, and researched problems Claude's troubleshooting did not resolve. An AI chat assistant helped with CORS; ChatGPT helped review the usage documentation. See [`AI-USAGE.md`](AI-USAGE.md) for decisions, corrections and contribution evidence.
