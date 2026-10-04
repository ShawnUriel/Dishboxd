# Dishboxd

[![Made with AI](https://img.shields.io/badge/Made_with-AI_assistance-blue)](AI-USAGE.md)

Built with heavy help from **Claude Code**, which wrote most of the original app, and **Codex**, which implemented the profiles, following, review photos and updated home page. What they did, where they went wrong and which parts are mine are in [`AI-USAGE.md`](AI-USAGE.md).

## 1. Overview

Dishboxd is a Letterboxd-style food and dining journal. Remember where you ate, what you ordered and how it tasted, with your own photos from each visit. Keep entries private or share selected reviews with other diners, follow their journals and collect your favourite restaurants on your profile.

**Current stage: working journal, diner profiles and social reviews.** Accounts use [Neon Auth](https://neon.com/docs/neon-auth), with verified email or Google sign-in. Entries, uploaded photos, profiles and follows persist through Express into Neon Postgres. Home combines your journal with Following and Discover feeds, restaurant suggestions and the existing paper/index-card design. Google restaurant search is optional; a new entry can also be filled in directly.

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

Each search costs one Autocomplete request. The first 10,000 a month are free, then about US$2.83 per 1,000 (Google's pricing page has current numbers). The app waits until you stop typing before it asks Google, and each user can search at most 30 times a minute.

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

It runs `backend/database_setup.sql` in a transaction and is safe to run again. **Run this before deploying an upgrade.** The profile/photo upgrade adds three tables and a sharing flag; existing visits stay private and existing journal data is preserved. The eight tables:

| Table | Holds |
| --- | --- |
| `restaurants` | A restaurant a user filed: catalog number (R-001…), name, address, and `google_place_id`, which is empty for places added by hand. |
| `visit_logs` | One visit (ticket): restaurant, date, 1–5 rating, notes and an explicit sharing flag (private by default). |
| `dishes` | The line items on a ticket, in order, with prices. |
| `boxes` | A user's card catalog boxes: title, colour, public or private. |
| `box_restaurants` | Which restaurants are filed in which box. |
| `profiles` | Unique username, display name, bio, avatar reference and up to four top restaurant picks. |
| `follows` | Follower/following relationships; duplicate follows and self-follows are prevented. |
| `media` | Compressed JPEG bytes and ownership, attached to a profile or review. |

Journal records and profiles belong to Neon Auth users, and account deletion cascades through their data. Composite foreign keys prevent visits and box entries from mixing users' restaurants. The API checks ownership before attaching a photo. UUIDs identify records; authorization checks protect private data.

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

**What you should see:** a ticket-style login card on ruled notebook paper. After signing in, **The Log** has a welcome card, journal statistics, recent reviews and suggestions, with `HOME`, `SEARCH`, `TRAY` and `PROFILE` tabs. A new journal starts empty and offers **NEW ENTRY**. On a phone the tabs become a bottom bar. Cards use subtle entrance and hover animations, with reduced-motion preferences respected.

To stop either server, press `Ctrl + C` in its terminal.

### Deploying to Vercel

Dishboxd deploys as **one Vercel project with two services**, set up in the root `vercel.json`. The `frontend` service serves the React app and the `backend` service runs the Express API. They share one address: every path under `/api/` goes to the backend and every other path goes to the frontend, so the browser calls the API on the same site.

1. In Vercel, choose **Add New → Project** and import the repository. Leave the Root Directory as the repository root; Vercel reads `vercel.json`.
2. Add the environment variables, which both services share: `DATABASE_URL`, `NEON_AUTH_URL`, `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACES_REGION`, `VITE_NEON_AUTH_URL`, and `CLIENT_ORIGIN` set to the site's address. Do not set `VITE_API_URL`: production builds call `/api` on the same site.
3. Run `npm run db:setup` from the backend against the deployment database before deploying new schema changes. Deploy, then add the site's address to Neon Auth's trusted domains (`neon neon-auth domain add …`), or login and Google sign-in will not work there.

Only variables whose names start with `VITE_` are built into the browser code, so the secrets stay on the server even though both services can see them.

## 4. Features and usage

Every journal page needs you to be logged in. The journal starts empty, and everything you add (restaurants, visits, boxes) is saved to the database straight away. If saving fails (for example, the backend is not running), the page says so and keeps what you typed.

### Accounts (Neon Auth)

- **Sign up with email** (`/signup`): enter your name, email and a password of at least 8 characters. Neon Auth emails you a code, and on **Check your email** (`/verify-email`) you type it in. The account only works after the code is confirmed, which proves the email is real and yours. A correct code also logs you in. **Send a new code** works every 30 seconds.
- **Log in** (`/login`): email and password. A wrong email or password shows "Wrong email or password." If you sign up but never confirm the code, logging in sends you a fresh code and takes you back to **Check your email**.
- **Continue with Google** (on both pages): signs you up the first time and logs you in after that. Google has already confirmed the email, so no code is needed.
- **Log out**: the link under the title on **The Log**.
- Each account owns its journal. Other signed-in diners can see only reviews explicitly shared by their author. Switching accounts clears the previous user's journal from memory.

### Primary flow: log a visit

1. On **The Log** (`/`), click **+ NEW ENTRY**.
2. The **Dishboxd Ticket** (`/log/new`) opens immediately. Choose a restaurant already in your journal or enter a restaurant name and optional address. The **Find on Google** link opens the optional Card Catalog search; choosing a result starts a ticket with its name and address filled in.
3. Choose the visit date and star rating, add dishes and prices, and write your review. Upload up to three photos from that visit. Leave **Share on my profile** unchecked for a private entry, or check it to share the review, dishes, notes and photos with signed-in diners. Click **STAMP & SUBMIT**. Validation keeps the form available if something needs fixing. At a previously visited restaurant, dish suggestions come from your own past tickets.
4. You land on the restaurant's profile (`/restaurant/:id`), with the new visit in **Visit history**. Its **+ NEW ENTRY** stamp logs another visit at the same restaurant. A restaurant found through Google has a **Menu & info on Google Maps** link, which opens its Google Maps page (menu, photos and opening hours, when the restaurant has them) in a new tab.
5. Click **+ FILE IN A BOX** to add the restaurant to a box. Make boxes first in the **TRAY** tab (`/lists`) with **New box**.

### Profiles and following

Use the **PROFILE** tab to upload an avatar and edit your display name, unique username and bio (up to 280 characters). Choose up to four **Top picks** from restaurants with a shared review. Your profile includes recent reviews, reviewed restaurants, and follower/following counts that open their member lists. Your own recent-review tab also shows your private entries, labelled as private; other diners see shared entries only.

**Find diners** opens a directory searchable by display name or username. Open a profile to follow or unfollow it. Home's **Following** tab shows shared reviews by diners you follow; **Discover** shows shared reviews from other diners. Review cards in your own profile can be shared or made private later. Making a review private also removes its photos from other diners' access and updates the public restaurant summary.

### Photo uploads

The uploader accepts JPEG, PNG and WebP files up to 12 MB, resizes them and converts them into JPEGs below the server's 750 KB limit. Review photos are limited to three per entry and accounts to 30 MB of stored photos. Avatars are resized separately; uploading a replacement removes the old avatar. Photos are stored in Postgres for this course project, so no separate storage account is needed. Private and unfinished review uploads are readable only by their owner; shared review photos and avatars require a signed-in viewer. Unattached uploads older than a day are cleaned up on the next upload.

### Pages

| Route | Page | What it shows |
| --- | --- | --- |
| `/login` | Log in | Email and password, or **Continue with Google** |
| `/signup` | Sign up | Name, email and password, or **Continue with Google** |
| `/verify-email` | Check your email | Enter the emailed code; **Send a new code** |
| `/` | The Log | Welcome card, statistics, Yours/Following/Discover review feeds, suggestions and **NEW ENTRY** |
| `/search` | Card Catalog | Search slip, ON FILE restaurants that match, Google Maps places to eat, and a NEW card to add a restaurant yourself |
| `/log/new` | Dishboxd Ticket | Restaurant fields, visit date, rating, dishes, notes, photos and optional sharing; opens directly |
| `/profile` | My profile | Editable name, username, bio, avatar and top picks; reviews, restaurants and connections |
| `/profile/:id` | Diner profile | Shared reviews, reviewed restaurants, top picks, follower/following lists and a follow button |
| `/people` | Find diners | Search profiles and follow/unfollow diners |
| `/restaurant/:id` | Restaurant profile | Photo, catalog number, average rating, **Menu & info on Google Maps** (Google places only), top dishes, visit history, **+ FILE IN A BOX**, **+ NEW ENTRY** |
| `/lists` | The Card Catalog | Every box as a coloured card, plus **New box** |
| `/lists/:id` | Box open | The box's title, description, Public/Private stamp and its restaurants |
| anything else | Nothing on file | A not-found page with a link home |

### Design system

- **Stack:** Tailwind CSS v4. All design tokens (colours, fonts, paper textures) are in `frontend/src/index.css` under `@theme`.
- **Colours:** brand red `#8c2f2f`, slate blue `#4e6887`, orange `#ffa25c`, on cream paper `#fffef8`. Every text colour was checked against WCAG AA (4.5:1). The grey and blue from the mockups were darkened slightly to pass, and the orange tab and light-coloured boxes use dark text instead of white.
- **Type:** Fraunces (headings and restaurant names) and IBM Plex Mono (everything else), self-hosted through Fontsource.
- **Components:** built in atomic layers in `frontend/src/components/` (`atoms/`, `molecules/`, `organisms/`), following my wireframe component tree.
- **Responsive:** below 768px the side tabs become a bottom tab bar, and the restaurant profile's two columns stack into one.
- **Motion:** subtle card entrances and hover movement; disabled when the viewer prefers reduced motion. Keyboard focus remains visible.

### API endpoints

Every route except `/api/test` needs a login: send the Neon Auth token as `Authorization: Bearer <token>` (the React app does this for you). The server checks its signature against Neon Auth's public keys. Journal writes are restricted to their owner; social reads expose profiles and explicitly shared reviews. All user input is passed through parameterized queries.

| Method | Path | Body | What it does | Success |
| --- | --- | --- | --- | --- |
| `GET` | `/api/test` | | Proves the server is running. No login needed. | `200` |
| `GET` | `/api/restaurants` | | The user's restaurants, by catalog number | `200` |
| `GET` | `/api/visits` | | The user's visits, newest first, each with its dishes | `200` |
| `POST` | `/api/visits` | `{ restaurantId }` **or** `{ place: { placeId, name, address } }`, plus `{ date, rating, notes, dishes, isPublic, photoIds }` | Atomically saves a ticket, dish lines and up to three owned photo references. `isPublic` defaults to false. | `201` `{ restaurant, visit }` |
| `PATCH` | `/api/visits/:id` | `{ isPublic }` | Shares or makes private one of the user's reviews | `200` |
| `GET` / `PATCH` | `/api/profiles/me` | For PATCH: `{ name, handle, bio, topPickIds }` | Loads or updates the user's profile | `200` |
| `GET` | `/api/profiles?q=...` | | Searches diner names and usernames | `200` |
| `GET` | `/api/profiles/:id` | | Profile, recent shared reviews and reviewed restaurants | `200` |
| `GET` | `/api/profiles/:id/connections?type=followers` | | Follower list; use `type=following` for following | `200` |
| `PUT` / `DELETE` | `/api/profiles/:id/follow` | | Follows/unfollows a diner idempotently | `200` |
| `GET` | `/api/profiles/feed?scope=following` | | Latest shared reviews; `scope=discover` includes other diners | `200` |
| `POST` | `/api/media` | Raw JPEG, `Content-Type: image/jpeg` | Uploads an owned photo to attach when submitting a review | `201` `{ id }` |
| `PUT` | `/api/media/avatar` | Raw JPEG | Replaces the user's profile avatar | `200` `{ id }` |
| `GET` / `DELETE` | `/api/media/:id` | | Reads a permitted photo or deletes an owned one | `200` |
| `GET` | `/api/boxes` | | The user's boxes, each with its `restaurantIds` | `200` |
| `POST` | `/api/boxes` | `{ title }` | Makes an empty box (colours rotate) | `201` `{ box }` |
| `POST` | `/api/boxes/:id/restaurants` | `{ restaurantId }` | Files a restaurant in a box | `201`, or `200` if it was already there |
| `GET` | `/api/places/autocomplete?q=jollibee` | | Asks Google Places for up to five places to eat matching `q` (2–100 characters). The backend adds the API key, so the browser never sees it. At most 30 searches a minute per user. | `200` `{ places: [{ placeId, name, address }] }` |

**Errors** are always JSON like `{"error":"Rating must be a whole number from 1 to 5."}`:

| Status | When |
| --- | --- |
| `400` | Invalid input (rating not 1–5, no dishes or more than 20, blank names, price outside 0–10,000, a future or impossible date, an over-long text), or a body that is not valid JSON |
| `401` | No login token, or an expired or tampered one |
| `404` | The restaurant or box does not exist **or belongs to someone else** (the API never reveals which), or an unknown path |
| `409` | A profile username is already taken |
| `413` | JSON body over 20 KB or a JPEG upload over 750 KB |
| `429` | More than 30 Google searches a minute or 30 photo uploads in ten minutes. `Retry-After` says how long to wait. |
| `500` | Anything unexpected. Details are logged in the backend terminal only, never sent to the browser. |
| `502` | Google did not answer or returned an error (Google's message is logged in the backend terminal only) |
| `503` | `GOOGLE_PLACES_API_KEY` is not set, so Google search is off |

### Not built yet

Sharing a public box by link, editing a saved review's text/date/dishes, and deleting visits and boxes. Review visibility can already be changed.

### Verification

```bash
cd frontend
npm run lint
npm run build
cd ../backend
npm test
```

Backend integration tests use real Postgres in a temporary schema and fixture authentication. Set `TEST_DATABASE_URL`, or configure `backend/.env`; the database role must be allowed to create schemas. The harness removes the temporary schema afterwards and does not modify real accounts or journals. Tests cover private/public review access, photo ownership, transactional saves, follows, profile validation, avatars and repeatable migrations. These tests do not test Neon signup or login.

For an isolated browser preview, run `node test/browser-preview.cjs` from `backend` and open `http://127.0.0.1:5173`. It uses real API routes and a temporary database schema with local fixture accounts; production authentication remains unchanged. Type `stop` in its terminal to clean up. Browser checks covered profile editing, avatar/review uploads, top picks, following, reload persistence and mobile layouts.

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
│       │   ├── atoms/           Button, TextField, RatingCircle, StarRating, Stamp, Tag, ...
│       │   ├── molecules/       GoogleButton, VisitLogCard, SearchResultItem, ManualPlaceForm, DishFormRow, ListCard, RestaurantCard
│       │   └── organisms/       AuthGate (login check), AuthCard, Navbar, VisitLogFeed, SearchAutocomplete, DishEntryList, RestaurantHeader, ListGrid
│       ├── pages/               Account pages, Home, Search, VisitForm, RestaurantProfile, Profile, People, Lists, ListDetail, NotFound
│       ├── state/               JournalProvider + useJournal: restaurants, visits and boxes in memory (starts empty, one per account)
│       └── lib/                 auth.js (Neon Auth client and error messages), api.js (calls the backend with the login token), formatting, and stats
└── backend/                     Express API
    ├── server.js                Server setup, CORS, routes, error handling
    ├── auth.js                  requireUser: checks the Neon Auth token on every journal route
    ├── validate.js              Server-side input checks (text, numbers, prices, dates, ids)
    ├── db.js                    Postgres connection pool and a transaction helper
    ├── rateLimit.js             perUserLimit: caps how often one user can call a route (used on Google search)
    ├── routes/                  restaurants.js, visits.js, boxes.js, places.js, profiles.js, media.js
    ├── social.js                Profile/review query columns and response formatting
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
- **Restaurant photos appear after a review photo is uploaded.** Restaurants without one retain the striped placeholder.
- **No edit or delete** for saved review text/dishes or boxes. Review sharing can be changed; boxes remain private.
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

**Credit:** Claude Code generated most of the original frontend and backend. Codex implemented diner profiles, following, review photos and the home redesign, and ran the associated verification. I directed the features, manually set up external APIs and deployment, and researched problems Claude's troubleshooting did not resolve. An AI chat assistant helped with CORS; ChatGPT helped review the usage documentation. See [`AI-USAGE.md`](AI-USAGE.md) for decisions, corrections and contribution evidence.
