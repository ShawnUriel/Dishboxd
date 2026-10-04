# Dishboxd

[![Made with AI](https://img.shields.io/badge/Made_with-AI_assistance-blue)](AI-USAGE.md)

Built with heavy help from **Claude Code**, Anthropic's AI coding assistant, which wrote most of the code from my README, designs and instructions. What it did, where it went wrong and which parts are mine are in [`AI-USAGE.md`](AI-USAGE.md).

## 1. Overview

Dishboxd is a Letterboxd-style personal food and dining journal. It is for foodies, cafe hoppers and local diners who want a visual diary of everywhere they have eaten and the specific dishes they liked across town. Instead of writing public reviews, it solves the problem of remembering exactly what you ordered, and whether you liked it, at each restaurant.

**Current stage: styled UI with working forms and user accounts.** All six screens from the design are built and styled (the Log, Card Catalog search, the entry ticket, restaurant profiles, boxes, and an open box). You sign up with an email address, confirmed by a code sent to that email, or with your Google account. Accounts are handled by [Neon Auth](https://neon.com/docs/neon-auth). The journal starts empty, and everything you log is saved through the Express API into a Neon Postgres database, so it is still there after a refresh or on another device. Typing a restaurant name searches Google Maps for places to eat, and a place Google does not know can still be added by hand.

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
| `VITE_API_URL` | `http://localhost:5000` | Where the Express API runs. Defaults to `http://localhost:5000`. |

**Backend** (`backend/.env`), required unless a default is given:

| Variable | Example value | What it does |
| --- | --- | --- |
| `PORT` | `5000` | Port the Express server listens on. Defaults to `5000`. |
| `CLIENT_ORIGIN` | `http://localhost:5173` | The only website allowed to call the API (CORS). Defaults to `http://localhost:5173`. |
| `DATABASE_URL` | `postgresql://user:password@host/neondb?sslmode=verify-full` | Your Neon connection string (Connect button in the console, or `neon connection-string`). **Secret.** |
| `NEON_AUTH_URL` | same as `VITE_NEON_AUTH_URL` | Used to check login tokens against Neon Auth's public keys. Not a secret. |
| `GOOGLE_PLACES_API_KEY` | `your_api_key_here` | Google Places API (New) key for the restaurant search. Optional: while it is missing or still the placeholder, search is limited to restaurants on file and ones you add by hand. **Secret**: it is only used by the backend and never reaches the browser. |
| `GOOGLE_PLACES_REGION` | `ph` | Two-letter country code. Google only suggests places in that country. Leave empty to search everywhere. |

### Database setup

Neon Auth's own tables (`neon_auth.user`, `neon_auth.session` and so on) are created when you enable Neon Auth. Create Dishboxd's tables once, from the backend folder:

```bash
cd backend
npm run db:setup     # prints: Tables ready: box_restaurants, boxes, dishes, restaurants, visit_logs
```

It runs `backend/database_setup.sql`, which is safe to run again. The tables:

| Table | Holds |
| --- | --- |
| `restaurants` | A restaurant a user filed: catalog number (R-001…), name, address, and `google_place_id`, which is empty for places added by hand. |
| `visit_logs` | One visit (ticket): restaurant, date, 1–5 rating, notes. |
| `dishes` | The line items on a ticket, in order, with prices. |
| `boxes` | A user's card catalog boxes: title, colour, public or private. |
| `box_restaurants` | Which restaurants are filed in which box. |

Every row has a `user_id` that points to `neon_auth.user`, so deleting an account deletes its whole journal. The foreign keys also include `user_id`, so the database itself refuses a visit or box entry that mixes two users' data. IDs are random UUIDs, so links cannot be guessed.

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

**What you should see:** the **Log in** page, a ticket-style card on ruled notebook paper. Sign up (see section 4) or continue with Google. After that you reach **The Log**, with coloured index tabs down the left (`HOME`, `SEARCH`, `TRAY`) and "Signed in as … · Log out" under the title. It starts empty, with the message "No entries yet. Use + New entry to log your first visit." Once you log visits, each one appears with a red rating circle, the restaurant name, the total and the dishes. On a phone-sized window the tabs move to a bottom bar.

To stop either server, press `Ctrl + C` in its terminal.

## 4. Features and usage

Every journal page needs you to be logged in. The journal starts empty, and everything you add (restaurants, visits, boxes) is saved to the database straight away. If saving fails (for example, the backend is not running), the page says so and keeps what you typed.

### Accounts (Neon Auth)

- **Sign up with email** (`/signup`): enter your name, email and a password of at least 8 characters. Neon Auth emails you a code, and on **Check your email** (`/verify-email`) you type it in. The account only works after the code is confirmed, which proves the email is real and yours. A correct code also logs you in. **Send a new code** works every 30 seconds.
- **Log in** (`/login`): email and password. A wrong email or password shows "Wrong email or password." If you sign up but never confirm the code, logging in sends you a fresh code and takes you back to **Check your email**.
- **Continue with Google** (on both pages): signs you up the first time and logs you in after that. Google has already confirmed the email, so no code is needed.
- **Log out**: the link under the title on **The Log**.
- Each account sees only its own journal. Switching accounts starts from an empty journal instead of showing the last user's entries.

### Primary flow: log a visit

1. On **The Log** (`/`), click **+ NEW ENTRY**.
2. On **Card Catalog** (`/search`), type the restaurant's name in the search slip.
   - Restaurants you have already logged show as **ON FILE**, and clicking one opens its record.
   - When you stop typing, places to eat from **Google Maps** appear below (restaurants, cafes, bakeries, bars and food courts; shops and other places are left out). A place whose name is exactly what you typed goes first, tagged **EXACT MATCH**, and pressing **Enter** picks it. Clicking a Google place starts a ticket for that exact restaurant, with its address. Places already on file are not repeated.
   - A **NEW** card always offers to add the name yourself, with an optional street address, for places that are not on Google Maps. Click **START TICKET**. If the name exactly matches one already on file, only the ON FILE card is shown (and Enter opens it), so you do not add it twice.
3. On the **Dishboxd Ticket** (`/log/new`), pick a star rating, type each dish and its price (use **+ add line item** for more), and add notes. The total adds itself up. Click **STAMP & SUBMIT**. If the rating or dishes are missing, the ticket says what to fix. At a restaurant you have logged before, the dish names you used there come up as you type, and picking one fills in the price you paid last time.
4. You land on the restaurant's profile (`/restaurant/:id`), with the new visit in **Visit history**. Its **+ NEW ENTRY** stamp logs another visit at the same restaurant. A restaurant found through Google has a **Menu & info on Google Maps** link, which opens its Google Maps page (menu, photos and opening hours, when the restaurant has them) in a new tab.
5. Click **+ FILE IN A BOX** to add the restaurant to a box. Make boxes first in the **TRAY** tab (`/lists`) with **New box**.

### Pages

| Route | Page | What it shows |
| --- | --- | --- |
| `/login` | Log in | Email and password, or **Continue with Google** |
| `/signup` | Sign up | Name, email and password, or **Continue with Google** |
| `/verify-email` | Check your email | Enter the emailed code; **Send a new code** |
| `/` | The Log | Recent visits (newest first), **+ NEW ENTRY**, a link to your boxes, and **Log out** |
| `/search` | Card Catalog | Search slip, ON FILE restaurants that match, Google Maps places to eat, and a NEW card to add a restaurant yourself |
| `/log/new` | Dishboxd Ticket | Star rating, dish lines with prices (suggesting dishes logged there before), running total and notes. Opening it directly sends you back to Search, because a ticket needs a restaurant. |
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

### API endpoints

Every route except `/api/test` needs a login: send the Neon Auth token as `Authorization: Bearer <token>` (the React app does this for you). The server checks the token's signature against Neon Auth's public keys, then only reads or writes that user's rows. All queries use `$1`-style parameters.

| Method | Path | Body | What it does | Success |
| --- | --- | --- | --- | --- |
| `GET` | `/api/test` | | Proves the server is running. No login needed. | `200` |
| `GET` | `/api/restaurants` | | The user's restaurants, by catalog number | `200` |
| `GET` | `/api/visits` | | The user's visits, newest first, each with its dishes | `200` |
| `POST` | `/api/visits` | `{ restaurantId }` **or** `{ place: { placeId, name, address } }`, plus `{ date, rating, notes, dishes: [{ name, price }] }` | Saves one ticket in a single transaction. A new `place` is filed as a restaurant first (`placeId: null` means added by hand). | `201` `{ restaurant, visit }` |
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
| `413` | Request body over 20 KB |
| `429` | More than 30 Google searches in a minute. The `Retry-After` header says how many seconds to wait. |
| `500` | Anything unexpected. Details are logged in the backend terminal only, never sent to the browser. |
| `502` | Google did not answer or returned an error (Google's message is logged in the backend terminal only) |
| `503` | `GOOGLE_PLACES_API_KEY` is not set, so Google search is off |

### Not built yet

Real photos, sharing a public box by link, and editing or deleting visits and boxes.

## 5. Project structure

```
Dishboxd/
├── README.md                    Project documentation (this file)
├── AI-USAGE.md                  Log of how AI tools were used in this build
├── .gitignore                   Keeps .env, node_modules and build output out of git
├── frontend/                    React app (Vite)
│   ├── index.html               Page shell that loads the React app
│   ├── .env.example             Placeholder for VITE_NEON_AUTH_URL
│   └── src/
│       ├── main.jsx             Entry point; loads fonts and styles, mounts <App />
│       ├── App.jsx              Routes: log-in pages, and the journal pages behind the login check
│       ├── index.css            Design tokens (@theme) and paper textures
│       ├── components/
│       │   ├── atoms/           Button, TextField, RatingCircle, StarRating, Stamp, Tag, ...
│       │   ├── molecules/       GoogleButton, VisitLogCard, SearchResultItem, ManualPlaceForm, DishFormRow, ListCard, RestaurantCard
│       │   └── organisms/       AuthGate (login check), AuthCard, Navbar, VisitLogFeed, SearchAutocomplete, DishEntryList, RestaurantHeader, ListGrid
│       ├── pages/               Login, SignUp, VerifyEmail, Home, Search, VisitForm, RestaurantProfile, Lists, ListDetail, NotFound
│       ├── state/               JournalProvider + useJournal: restaurants, visits and boxes in memory (starts empty, one per account)
│       └── lib/                 auth.js (Neon Auth client and error messages), api.js (calls the backend with the login token), formatting, and stats
└── backend/                     Express API
    ├── server.js                Server setup, CORS, routes, error handling
    ├── auth.js                  requireUser: checks the Neon Auth token on every journal route
    ├── validate.js              Server-side input checks (text, numbers, prices, dates, ids)
    ├── db.js                    Postgres connection pool and a transaction helper
    ├── rateLimit.js             perUserLimit: caps how often one user can call a route (used on Google search)
    ├── routes/                  restaurants.js, visits.js, boxes.js, places.js (Google search; one file per resource)
    ├── database_setup.sql       CREATE TABLE commands (run with npm run db:setup)
    ├── setup-db.js              Runs database_setup.sql against DATABASE_URL
    └── .env.example             Placeholder environment variables
```

## 6. Screenshots

Screenshots are kept in my private course workspace and embedded in `project/Documentation/Documentation.md` there:

- **Styled UI (2026-09-27), in `project/Documentation/ui-screenshots/`:** the empty starting Log, then each screen after adding entries through the forms: Card Catalog with the "add it yourself" card, the ticket, a restaurant profile, the Log, the boxes, and an open box. Also the search, ticket and restaurant profile at phone width.
- **Week 1 skeleton (2026-09-23), in `project/Documentation/`:** the unstyled placeholder pages, the `GET /api/test` response, and the security-check evidence.

## 7. Known issues and next steps

Accounts, the screens, the forms and saving to the database all work. It is not deployed yet.

**Known issues**

- **Development-only sign-in settings.** Google sign-in uses Neon's shared keys, so Google's consent screen shows Neon's name and logo. Verification emails come from Neon's shared sender (`auth@mail.myneon.app`). Before launch: my own Google OAuth keys, my own email provider, and my site's address added to Neon Auth's trusted domains.
- **Neon Auth's JavaScript package is a beta** (`@neondatabase/auth` 0.5), so its API may change. It also makes the app bundle about 630 KB, which Vite warns about.
- **No "forgot password" page yet.**
- **Google search misses some places.** Google sends at most five suggestions per search, and Dishboxd hides the ones that are not places to eat (in testing, "SM City Clark" and "Holy Angel University" were hidden correctly). A restaurant that Google files only as a generic "establishment" is hidden too; one Mang Inasal branch was. Google also may not know a name the way you type it ("Starbucks Marquee Mall" found nothing). In those cases the restaurant can still be added by hand.
- **Search results lean toward the server's location.** Without a location in the request, Google favours places near the computer that asks, which is the backend. Locally that is near you (results were around Angeles); once deployed it is the hosting company's data centre, so results may stop favouring Pampanga.
- **No menus from Google.** The Places API does not return menus or dishes, so a Google place links to its Google Maps page instead, and dish suggestions come only from your own past tickets.
- **Photos are striped placeholders.**
- **No edit or delete** for visits, boxes or the Public/Private setting. Every box is private for now; the database has an `is_public` column, but nothing sets it yet.
- **Rate limiting only on Google search.** Neon Auth limits login attempts and Google search allows 30 searches a minute per user, but the other journal routes have no limit. The search counts are kept in the server's memory, so they reset when it restarts and are not shared between servers (for example, Vercel instances).
- **The app's database role owns the tables.** It connects as Neon's default owner role rather than a role with only the permissions it needs (security checklist row 15).
- **The third tab says "TRAY"**, but my mockups call it "TRAY" on some screens and "BOXES" on others. I picked TRAY for now.

**Next steps**

1. Send a location with Google searches (the user's, if they allow it, or a set area such as Angeles City) so results stay local after deploying.
2. Edit and delete routes (`PATCH`/`DELETE`) for visits and boxes, and a public link for public boxes.
3. Deploy: frontend and API on Vercel, with the site's address added to Neon Auth's trusted domains. Before a real launch: my own Google OAuth keys and email provider.

## Security checklist

The completed security checklist is kept in my private course workspace at `project/SECURITY-CHECKLIST.md`, as the course asks, with its evidence screenshots next to it. Every row is answered Yes, No or N/A with evidence.

## AI usage

Claude Code (Anthropic's AI coding assistant) wrote most of the code in this project, and an AI chat tool helped me debug CORS in Week 1. What I asked for, what I kept or changed, where the AI got it wrong, and which code is mine are logged in [`AI-USAGE.md`](AI-USAGE.md).

**Credit:** Built with help from AI tools (an AI chat assistant and Claude Code); see [`AI-USAGE.md`](AI-USAGE.md).
