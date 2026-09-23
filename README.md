# Dishboxd

## 1. Overview

Dishboxd is a Letterboxd-style personal food and dining journal. It is for foodies, cafe hoppers and local diners who want a visual diary of everywhere they have eaten and the specific dishes they liked across town. Instead of writing public reviews, it solves the problem of remembering exactly what you ordered, and whether you liked it, at each restaurant.

**Current stage: Week 1 foundation.** The app is a working skeleton: three placeholder pages connected by navigation, and a backend with one test endpoint. There is no database connection or styling yet (see section 7).

## 2. Setup and installation

### Install first

| Tool | Version | Needed for |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) (includes npm) | 20.19+ or 22.12+ (tested on Node 24.16.0, npm 11.6.2) | Running the frontend and backend |
| [Git](https://git-scm.com/) | Any recent version | Cloning the repository |
| [PostgreSQL](https://www.postgresql.org/download/) | 14+ | **Not needed yet.** The database is not connected in Week 1. |

### Get the code

```bash
git clone https://github.com/ShawnUriel/Dishboxd.git
cd Dishboxd
```

### Install dependencies

The frontend and backend each have their own `package.json`, so install both:

```bash
cd frontend
npm install        # React, React Router, Vite
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

The frontend has one optional variable, `VITE_API_URL` (default `http://localhost:5000`). Set it in `frontend/.env` only if your backend runs somewhere else.

With the defaults, the app runs even without a `.env` file.

### Database setup

The database is **not connected to the code yet**, so you can skip this step for now. The table definitions are ready in `backend/database_setup.sql` (tables: `restaurants`, `visit_logs`, `dishes`). When the database is wired in, you will set it up with:

```bash
createdb dishboxd
psql -d dishboxd -f backend/database_setup.sql
```

There is no seed data yet.

## 3. How to run it

Start the backend and the frontend in **two separate terminals**.

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

**What you should see:** a plain white page with a navigation bar (`Home | Search | Visit Form`), the heading **Dishboxd**, and the line **"Backend status: Dishboxd backend is working!"**. If that line says **"Backend not reachable"**, the backend in Terminal 1 is not running.

To stop either server, press `Ctrl + C` in its terminal.

## 4. Features and usage

The app is a skeleton right now. Here is what works:

### Primary flow

1. Open <http://localhost:5173>. The **Home** page loads and calls the backend once to show its status.
2. Click **Search** in the navigation bar to go to `/search`, the placeholder for restaurant discovery (Google Places search goes here later).
3. Click **Visit Form** to go to `/log/new`, the placeholder for logging a visit and its dishes.
4. Click **Home** to go back. Every page has the same navigation bar, so there are no dead ends.

### Pages

| Route | Page | Current state |
| --- | --- | --- |
| `/` | Home | Heading, placeholder text and live backend status |
| `/search` | Search | Placeholder text |
| `/log/new` | Visit Form | Placeholder text |

### API endpoints

| Method | Path | What it does |
| --- | --- | --- |
| `GET` | `/api/test` | Returns `{"message":"Dishboxd backend is working!"}` to prove the server is running and CORS is working. |
| any | any other path | Returns `404` with `{"error":"Not found"}`. |

If the server hits an error, it returns `500` with `{"error":"Something went wrong"}` and logs the details only in the backend terminal.

### Planned features (from the wireframes)

Logging visits with multiple dishes, per-dish ratings and prices, restaurant profiles with visit history and top dishes, and curated lists ("boxes") of restaurants. None of these are built yet.

## 5. Project structure

```
Dishboxd/
├── README.md                    Project documentation (this file)
├── AI-USAGE.md                  Log of how AI tools were used in this build
├── .gitignore                   Keeps .env, node_modules and build output out of git
├── frontend/                    React app (Vite)
│   ├── index.html               Page shell that loads the React app
│   └── src/
│       ├── main.jsx             Entry point; mounts <App />
│       ├── App.jsx              React Router setup and the navigation bar
│       ├── components/          Reusable UI pieces (empty for now)
│       └── pages/
│           ├── Home.jsx         Home page and backend status check
│           ├── Search.jsx       Search placeholder
│           └── VisitForm.jsx    Visit Form placeholder
├── backend/                     Express API
│   ├── server.js                Server setup, CORS, /api/test, error handlers
│   ├── database_setup.sql       CREATE TABLE commands (not run yet)
│   └── .env.example             Placeholder environment variables
└── project/
    └── SECURITY-CHECKLIST.md    Completed security checklist
```

## 6. Screenshots

Screenshots of the app running locally (Home, Search, Visit Form and the `GET /api/test` response, taken 2026-09-23) are in my course workspace repository, `student-6apsi-2203-ShawnUriel`, under `project/screenshots/`, and embedded in `project/Documentation.md` there. There is no styling yet, so the pages are plain white.

## 7. Known issues and next steps

Being honest: almost everything is still left to do.

**Known issues**

- **The database is not connected.** `backend/database_setup.sql` has not been run, and nothing is saved anywhere.
- **There is no styling.** Every page is plain HTML text on a white background, nothing like the wireframes yet.
- **The pages are placeholders.** Search and Visit Form have no inputs or behavior.
- **There is no access layer** (login or password gate). This is required before the app is deployed (security checklist row 18).
- **Invalid JSON returns `500` instead of `400`.** It still leaks no details, but the status code is wrong.

**Next steps**

1. Build a small separate test file that fetches data from the Google Places API, before wiring it into the Search page.
2. Create the PostgreSQL database from `database_setup.sql` and connect it with parameterized queries.
3. Build the Visit Form (visit fields plus a repeating list of dishes).
4. Turn the wireframes into a design system (palette, type, spacing tokens) and style the pages.
5. Add an access layer before deploying.

## Security checklist

The completed checklist is in [`project/SECURITY-CHECKLIST.md`](project/SECURITY-CHECKLIST.md). Every row is answered Yes, No or N/A with evidence. Evidence screenshots `05`–`10` are in my workspace repository under `project/screenshots/`. The one open **No** is row 18 (there is no access layer yet).

## AI usage

AI tools helped build this project. What they were used for, and what I checked myself, is logged in [`AI-USAGE.md`](AI-USAGE.md).

**Credit:** Built by ShawnUriel with help from AI tools (an AI chat assistant and Claude Code); see [`AI-USAGE.md`](AI-USAGE.md).
