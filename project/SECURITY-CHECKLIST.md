# Security checklist — Dishboxd

Checked on 2026-09-23 against the Week 1 skeleton (Vite + React frontend, Express backend, SQL file not yet run).
Screenshots of each check (`05`–`10`, named in the rows below) are in my workspace repository under `project/screenshots/`.

## Secrets and credentials

| # | Check | Yes / No / N/A | Evidence |
| --- | --- | --- | --- |
| 1 | `.env` is gitignored and is not in the repository | Yes | `.gitignore` line 2 (`.env`) matches `backend/.env` per `git check-ignore -v`, and `git ls-files` lists no `.env` file. See `05-env-gitignored.png`. |
| 2 | A `.env.example` with placeholder values only is committed | Yes | `backend/.env.example` holds only `your_postgres_username`, `your_postgres_password`, `your_api_key_here` style placeholders. |
| 3 | No connection string, key, token or password is hardcoded in source, comments or commented-out code | Yes | Grepped the repo (excluding `node_modules`) for password/secret/api key/token/`postgres://`: only hits are placeholder lines in `.env.example` and the ignored local `.env`. See `07-source-secret-and-email-scan.png`. |
| 4 | Git history is clean: I searched `git log -p` for password, secret, api key and `postgres://` | Yes | `git log --all -p` grep returned no matches; history is a single "Initial commit" containing only `README.md`. See `06-git-history-scan.png`. |
| 5 | Any credential that was ever committed has been rotated | N/A | No credential has ever been committed (row 4), and no real credentials exist yet: the database is not set up and the Google Places key is not created. |
| 6 | Production credentials live only in my hosting provider's environment settings | N/A | The app is not deployed anywhere yet; it only runs on localhost. When I deploy, `DB_*` and `GOOGLE_PLACES_API_KEY` go in the host's environment settings. |

## GitHub Actions

The repository has no workflows (there is no `.github/` folder), so rows 7–12 are N/A.

| # | Check | Yes / No / N/A | Evidence |
| --- | --- | --- | --- |
| 7 | No secret value is written literally in any workflow YAML file | N/A | No workflows exist. |
| 8 | Secrets are stored in repository Actions secrets and read with `${{ secrets.NAME }}` | N/A | No workflows exist. |
| 9 | No workflow step echoes, dumps or debug-prints a secret, and I opened a recent run's log to confirm | N/A | No workflows exist, so there are no runs. |
| 10 | Uploaded build artifacts contain no `.env`, key file or generated config | N/A | No workflows, so no uploaded artifacts. |
| 11 | Third-party actions are pinned to a commit SHA, not a moveable tag | N/A | No workflows, so no third-party actions. |
| 12 | Secret scanning and push protection are enabled on the repository | N/A | No workflows. Separately, I still need to confirm in GitHub Settings → Code security that secret scanning and push protection are on, since the repo is public. |

## Database

| # | Check | Yes / No / N/A | Evidence |
| --- | --- | --- | --- |
| 13 | Every query taking user input uses parameters, never string concatenation | N/A | The app runs no queries yet. `backend/database_setup.sql` only has `CREATE TABLE` statements; when I connect `pg` I will use `$1` placeholders. |
| 14 | The database is not open to the whole internet, or is reachable only by the app | N/A | No database has been created for the app yet; the SQL file has not been run. |
| 15 | The database user the app connects as has only the permissions it needs | N/A | No database or database user exists yet. |
| 16 | Seed and sample data is invented, not real people's data | N/A | There is no seed data at all; `database_setup.sql` has only table definitions and a comment that any future sample rows must be made up. |
| 17 | Debug, seed and reset routes are removed before going public | Yes | `backend/server.js` has one route, `GET /api/test`, which returns a fixed message and touches no data. No seed, reset or debug routes exist. |

## Access control

| # | Check | Yes / No / N/A | Evidence |
| --- | --- | --- | --- |
| 18 | The app has an access layer: Cloudflare Zero Trust, an app-level password, or a real login | No | There is no gate yet. The app only runs on localhost and is not deployed; I must add a gate before it goes online. |
| 19 | If Supabase or Firebase: Row Level Security or security rules are on, and I tested it signed out | N/A | I use PostgreSQL with Express, not Supabase or Firebase. |
| 20 | If Zero Trust: tjakoen.s@gmail.com is on the access policy. If an app password: the credentials are in my private workspace `project/README.md` | N/A | No gate exists yet (row 18). I will fill this in when I choose Zero Trust or an app password. |
| 21 | The gate covers every route, including the ones that only change data | N/A | No gate yet, and there are no routes that change data (only `GET /api/test`). |
| 22 | The credentials for the gate are environment variables, not in source | N/A | No gate credentials exist yet. The `.env` / `.env.example` pattern is already set up for them. |

## Input and output

| # | Check | Yes / No / N/A | Evidence |
| --- | --- | --- | --- |
| 23 | Input from the user is validated on the server, not only in the browser | N/A | The backend accepts no user input yet (only `GET /api/test` with no parameters). The SQL tables already have `CHECK` constraints on ratings (0–5) and prices (≥ 0). |
| 24 | User-supplied text is escaped when rendered, so it cannot inject markup or script | Yes | All text is rendered through React JSX, which escapes it; grep for `dangerouslySetInnerHTML`, `innerHTML` and `eval(` in `frontend/src` and `server.js` found nothing. |
| 25 | Error responses do not expose stack traces, file paths or connection details | Yes | `server.js` has a 404 handler and an error handler that logs server-side and returns only `{"error":"Something went wrong"}`. Tested with a malformed JSON body. See `09-cors-and-error-responses.png`. |
| 26 | CORS is not a wildcard on routes that change data | Yes | `cors({ origin: CLIENT_ORIGIN })` defaults to `http://localhost:5173`; a request from `https://evil.example` still only gets `Access-Control-Allow-Origin: http://localhost:5173`, so the browser blocks it. See `09-cors-and-error-responses.png`. |

## Repository and privacy

| # | Check | Yes / No / N/A | Evidence |
| --- | --- | --- | --- |
| 27 | No student number, personal email, phone number or home address in the repository or in commit messages | Yes | The only commit is authored with my GitHub `noreply` address; an email-pattern grep of the code found none. The one email in this repo is the instructor's, which comes from the checklist template in row 20. See `06` and `07` screenshots. |
| 28 | No classmate's personal data in the repository | Yes | The repo has only my code, an empty SQL schema and placeholder text; there is no data about anyone. |
| 29 | Dependencies come from official registries, and `node_modules` is gitignored | Yes | All 142 packages in both `package-lock.json` files resolve from `https://registry.npmjs.org`; `npm audit` reports 0 vulnerabilities; `node_modules/` is ignored in `.gitignore`. See `05` and `08` screenshots. |
| 30 | Images, fonts and other assets are mine, licensed, or credited | Yes | The only asset is Vite's default `favicon.svg` (MIT-licensed Vite template); I deleted the other template images. The screenshots are my own. No custom fonts yet. |
| 31 | Repository visibility is deliberate, and I checked it after my last push | Yes | The GitHub API shows `ShawnUriel/Dishboxd` is `public`, checked after the last push (2026-09-23 13:57 UTC). I will check again after pushing this week's work. See `10-repo-visibility.png`. |

## Anything I found and fixed

The checklist showed that my repository was already public while it had no `.gitignore` at all. The first time I committed the backend, my `.env` and `node_modules` would have gone straight to GitHub. I added a root `.gitignore` for `.env`, `node_modules` and build output, and a placeholder-only `.env.example`. I also limited CORS to my Vite origin instead of allowing every site, and added error handlers so the server never sends stack traces to the browser. It also caught that my machine has `NODE_TLS_REJECT_UNAUTHORIZED=0` set, which switches off HTTPS certificate checks for Node, so I plan to remove it. The main gap still open is row 18: there is no access layer yet, and I need to add one before the app is deployed.
