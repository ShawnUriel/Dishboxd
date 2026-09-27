# Dishboxd

## 1. Overview

Dishboxd is a Letterboxd-style personal food and dining journal. It is for foodies, cafe hoppers and local diners who want a visual diary of everywhere they have eaten and the specific dishes they liked across town. Instead of writing public reviews, it solves the problem of remembering exactly what you ordered, and whether you liked it, at each restaurant.

**Current stage: styled UI with working forms.** All six screens from the design are built and styled (the Log, Card Catalog search, the entry ticket, restaurant profiles, boxes, and an open box). The app starts empty, and you fill it yourself by logging visits and making boxes. Entries are kept in the browser's memory until the PostgreSQL database and Google Places are connected (see section 7).

## 2. Setup and installation

### Install first

| Tool | Version | Needed for |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) (includes npm) | 20.19+ or 22.12+ (tested on Node 24.16.0, npm 11.6.2) | Running the frontend and backend |
| [Git](https://git-scm.com/) | Any recent version | Cloning the repository |
| [PostgreSQL](https://www.postgresql.org/download/) | 14+ | **Not needed yet.** The database is not connected yet. |

### Get the code

```bash
git clone https://github.com/ShawnUriel/Dishboxd.git
cd Dishboxd
```

### Install dependencies

The frontend and backend each have their own `package.json`, so install both:

```bash
cd frontend
npm install        # React, React Router, Vite, Tailwind CSS, fonts
cd ../backend
npm install        # Express, cors, dotenv
```

### Environment and configuration

The backend reads its settings from `backend/.env`. Copy the example file and fill in your own values:

```bash
cd backend
cp .env.example .env
```

`.env` is gitignored, so never commit real credentials. Only `backend/.env.example` (placeholders) is in the repository.

| Variable | Example value | What it does | Used yet? |
| --- | --- | --- | --- |
| `PORT` | `5000` | Port the Express server listens on. Defaults to `5000` if unset. | Yes |
| `CLIENT_ORIGIN` | `http://localhost:5173` | The only website allowed to call the API (CORS). Defaults to `http://localhost:5173` if unset. | Yes |
| `DB_USER` | `your_postgres_username` | PostgreSQL username | Not yet |
| `DB_PASSWORD` | `your_postgres_password` | PostgreSQL password | Not yet |
| `GOOGLE_PLACES_API_KEY` | `your_api_key_here` | Google Places API key for restaurant search | Not yet |

The frontend needs no environment variables yet.

With the defaults, the app runs even without a `.env` file.

### Database setup

The database is **not connected to the code yet**, so you can skip this step for now. The table definitions are ready in `backend/database_setup.sql` (tables: `restaurants`, `visit_logs`, `dishes`). When the database is wired in, you will set it up with:

```bash
createdb dishboxd
psql -d dishboxd -f backend/database_setup.sql
```

There is no seed data: the app and the database both start empty. `google_place_id` is optional, so restaurants that are not on Google Maps can still be saved.

## 3. How to run it

Start the backend and the frontend in **two separate terminals**. (The UI does not call the backend yet, so the frontend alone is enough to click through the screens.)

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

**What you should see:** **The Log**, on ruled notebook paper, with coloured index tabs down the left (`HOME`, `SEARCH`, `TRAY`). It starts empty, with the message "No entries yet. Use + New entry to log your first visit." Once you log visits, each one appears with a red rating circle, the restaurant name, the total and the dishes. On a phone-sized window the tabs move to a bottom bar.

To stop either server, press `Ctrl + C` in its terminal.

## 4. Features and usage

The app starts empty. Everything you add (restaurants, visits, boxes) stays until you refresh the page, because nothing is saved to the database yet.

### Primary flow: log a visit

1. On **The Log** (`/`), click **+ NEW ENTRY**.
2. On **Card Catalog** (`/search`), type the restaurant's name in the search slip.
   - Restaurants you have already logged show as **ON FILE**, and clicking one opens its record.
   - For a new name, a **NEW** card offers to add it yourself, with an optional street address. This is for places that are not on Google Maps. Click **START TICKET**. If the name exactly matches one already on file, only the ON FILE card is shown, so you do not add it twice.
3. On the **Dishboxd Ticket** (`/log/new`), pick a star rating, type each dish and its price (use **+ add line item** for more), and add notes. The total adds itself up. Click **STAMP & SUBMIT**. If the rating or dishes are missing, the ticket says what to fix.
4. You land on the restaurant's profile (`/restaurant/:id`), with the new visit in **Visit history**. Its **+ NEW ENTRY** stamp logs another visit at the same restaurant.
5. Click **+ FILE IN A BOX** to add the restaurant to a box. Make boxes first in the **TRAY** tab (`/lists`) with **New box**.

### Pages

| Route | Page | What it shows |
| --- | --- | --- |
| `/` | The Log | Recent visits (newest first), **+ NEW ENTRY**, and a link to your boxes |
| `/search` | Card Catalog | Search slip, ON FILE restaurants that match, and a NEW card to add a restaurant yourself |
| `/log/new` | Dishboxd Ticket | Star rating, dish lines with prices, running total and notes. Opening it directly sends you back to Search, because a ticket needs a restaurant. |
| `/restaurant/:id` | Restaurant profile | Photo, catalog number, average rating, top dishes, visit history, **+ FILE IN A BOX**, **+ NEW ENTRY** |
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

| Method | Path | What it does |
| --- | --- | --- |
| `GET` | `/api/test` | Returns `{"message":"Dishboxd backend is working!"}` to prove the server is running and CORS is working. |
| any | any other path | Returns `404` with `{"error":"Not found"}`. |

If the server hits an error, it returns `500` with `{"error":"Something went wrong"}` and logs the details only in the backend terminal.

### Not built yet

Google Places search (the spot for its results is marked in `SearchAutocomplete.jsx`), real photos, saving to the database, and editing or deleting visits and boxes.

## 5. Project structure

```
Dishboxd/
├── README.md                    Project documentation (this file)
├── AI-USAGE.md                  Log of how AI tools were used in this build
├── .gitignore                   Keeps .env, node_modules and build output out of git
├── frontend/                    React app (Vite)
│   ├── index.html               Page shell that loads the React app
│   └── src/
│       ├── main.jsx             Entry point; loads fonts and styles, mounts <App />
│       ├── App.jsx              Page layout (tabs + ruled paper) and the routes
│       ├── index.css            Design tokens (@theme) and paper textures
│       ├── components/
│       │   ├── atoms/           Button, RatingCircle, StarRating, Stamp, Tag, ...
│       │   ├── molecules/       VisitLogCard, SearchResultItem, ManualPlaceForm, DishFormRow, ListCard, RestaurantCard
│       │   └── organisms/       Navbar, VisitLogFeed, SearchAutocomplete, DishEntryList, RestaurantHeader, ListGrid
│       ├── pages/               Home, Search, VisitForm, RestaurantProfile, Lists, ListDetail, NotFound
│       ├── state/               JournalProvider + useJournal: restaurants, visits and boxes in memory (starts empty)
│       └── lib/                 Formatting (money, dates) and stats (totals, averages, top dishes)
└── backend/                     Express API
    ├── server.js                Server setup, CORS, /api/test, error handlers
    ├── database_setup.sql       CREATE TABLE commands (not run yet)
    └── .env.example             Placeholder environment variables
```

## 6. Screenshots

Screenshots are kept in my private course workspace and embedded in `project/Documentation/Documentation.md` there:

- **Styled UI (2026-09-27), in `project/Documentation/ui-screenshots/`:** the empty starting Log, then each screen after adding entries through the forms: Card Catalog with the "add it yourself" card, the ticket, a restaurant profile, the Log, the boxes, and an open box. Also the search, ticket and restaurant profile at phone width.
- **Week 1 skeleton (2026-09-23), in `project/Documentation/`:** the unstyled placeholder pages, the `GET /api/test` response, and the security-check evidence.

## 7. Known issues and next steps

The screens and forms work, but nothing is saved yet.

**Known issues**

- **A refresh clears everything.** Entries live in the browser's memory. `backend/database_setup.sql` has still not been run.
- **No Google Places yet.** Search only finds restaurants you have already logged, so every new restaurant is added by hand for now.
- **Photos are striped placeholders.**
- **No edit or delete** for visits, boxes or the Public/Private setting.
- **The third tab says "TRAY"**, but my mockups call it "TRAY" on some screens and "BOXES" on others. I picked TRAY for now.
- **There is no access layer** (login or password gate). This is required before the app is deployed (security checklist row 18).
- **Invalid JSON returns `500` instead of `400`.** It still leaks no details, but the status code is wrong.

**Next steps**

1. Build a small separate test file that fetches data from the Google Places API, then show its results in the Search page. When a typed name exactly matches a Google place, file that exact restaurant (with its place ID and address). Keep the "add it yourself" card for places Google does not know. Call Google from the backend so `GOOGLE_PLACES_API_KEY` stays in `backend/.env` and never reaches the browser.
2. Create the PostgreSQL database from `database_setup.sql` and connect it with parameterized queries.
3. Add API routes for visits, restaurants and boxes, validate their input on the server, and swap `JournalProvider`'s in-memory state for real requests.
4. Add an access layer before deploying.

## Security checklist

The completed security checklist is kept in my private course workspace at `project/SECURITY-CHECKLIST.md`, as the course asks, with its evidence screenshots next to it. Every row is answered Yes, No or N/A with evidence. Row 18 is still **No**, because there is no access layer yet.

## AI usage

AI tools helped build this project. What they were used for, and what I checked myself, is logged in [`AI-USAGE.md`](AI-USAGE.md).

**Credit:** Built with help from AI tools (an AI chat assistant and Claude Code); see [`AI-USAGE.md`](AI-USAGE.md).
