# AI usage

I built Dishboxd with a lot of help from AI, mostly **Claude Code** (Anthropic's coding assistant), plus an AI chat tool once in Week 1. Claude Code wrote most of the code in this repository. My part was the idea and the README, the design system and wireframes it built from, the decisions written down below, checking its work in the browser, and catching the times it went the wrong way. Section 3 says which code is mine.

Commit links go to this repository. The links marked *(workspace)* go to my private course workspace, where my documentation and security checklist live.

## 1. How I used AI

**2026-09-23 · AI chat tool · Debugging CORS**
- **What I asked:** why my React frontend could not fetch a test message from my Express backend. I pasted the confusing browser console error.
- **What it gave back:** it explained that this was a CORS error: the browser blocks the response unless the server says my site's origin is allowed, so the fix belongs on the server, not in React.
- **What I kept or changed, and why:** I kept the explanation; it is how I learned what CORS is. I worked on that fix in an earlier local copy of the project that never went into this repository. The CORS code that is in this repo came in with the Week 1 skeleton below.
- **Commit:** [`52d3086`](https://github.com/ShawnUriel/Dishboxd/commit/52d3086), where CORS landed in this repo.

**2026-09-23 · Claude Code · Week 1 skeleton and security check**
- **What I asked:** to scaffold the Week 1 skeleton from my README and fill in the course's security checklist, with screenshots as evidence.
- **What it gave back:** Vite + React Router placeholder pages, an Express `server.js` with `GET /api/test`, CORS limited to my Vite origin, error handlers that hide stack traces, `database_setup.sql` (not run yet), `.gitignore`, `.env.example`, and the filled-in checklist with screenshots.
- **What I kept or changed, and why:** I reviewed the files and the checklist and kept them. The check found that my public repo had no `.gitignore` at all, so my `.env` and `node_modules` would have been pushed with the first backend commit.
- **Commit:** [`52d3086`](https://github.com/ShawnUriel/Dishboxd/commit/52d3086)

**2026-09-27 · Claude Code · Styled UI from my design system**
- **What I asked:** to build the UI from my "Project Design System" mockups.
- **What it gave back:** Tailwind colour and font tokens, atomic components, all six screens, working forms, the phone layout, a colour-contrast check, and a test run in headless Chrome.
- **What I kept or changed, and why:** I changed direction twice before keeping it (both are in section 2): I did not want made-up sample data, and I needed the inputs to stay. I asked for an "add it yourself" card for restaurants that are not on Google Maps. I kept its contrast fixes (a slightly darker grey and blue than my mockups, dark text on the orange tab and light boxes) because the mockup colours failed WCAG AA.
- **Commits:** [`b0ba43a`](https://github.com/ShawnUriel/Dishboxd/commit/b0ba43a), README follow-up [`890715e`](https://github.com/ShawnUriel/Dishboxd/commit/890715e)

**2026-09-27 · Claude Code · Week 2 documentation, report and journal**
- **What I asked:** to write my Week 2 documentation, project increment report and reflection journal from my templates, with screenshots of the app.
- **What it gave back:** `Documentation.md`, `report.md` and a Week 2 journal in my workspace, plus the screenshots.
- **What I kept or changed, and why:** I checked the report against what I had actually built and had the screenshots redone as real image files (section 2, case 3).
- **Commit:** [`1dc13ea`](https://github.com/HAU-6APSI/student-6apsi-2203-ShawnUriel/commit/1dc13ea) *(workspace)*

**2026-09-28 · Claude Code · Cleaning my repository's history**
- **What I asked:** to fix the privacy problems the checklist found before the Week 2 deadline.
- **What it gave back:** it rewrote my "Week1" commit to use my GitHub noreply address instead of my personal Gmail, moved `SECURITY-CHECKLIST.md` (which has my instructor's email from the template) into my private workspace, removed my name from the README credit, and rewrote the history so no old commit still contains them. At my request it also removed its "Co-Authored-By" line from my commit messages, because this file is where my AI use is recorded.
- **What I kept or changed, and why:** I chose each option myself: rewrite the email, move the checklist, clean the old commits too. A force-push changes history, so I wanted to decide that, not the AI.
- **Commits:** [`5ee6c58`](https://github.com/ShawnUriel/Dishboxd/commit/5ee6c58), [`c2f5d66`](https://github.com/HAU-6APSI/student-6apsi-2203-ShawnUriel/commit/c2f5d66) *(workspace)*

**2026-10-04 · Claude Code · Accounts with Neon Auth**
- **What I asked:** whether to use Neon or Supabase for the database (it recommended Neon), and then for accounts where the email must be real, confirmed by a code sent to it, with Google sign-in as well.
- **What it gave back:** it checked that the `neon` npm package was Neon's official CLI before using it, linked my Neon project, turned on required email verification in Neon Auth, and built the Log in, Sign up and "Check your email" pages, a login check on every journal page, and Log out. It tested them against my real Neon Auth with a throwaway `example.com` account, then deleted it.
- **What I kept or changed, and why:** I chose Neon and Neon Auth, so the database and the accounts are in one place and I do not store passwords myself. I asked for the emailed code because I only want accounts with real, working email addresses. It left out Neon's optional AI-tool setup steps, which Dishboxd does not need.
- **Commit:** [`66bb776`](https://github.com/ShawnUriel/Dishboxd/commit/66bb776)

**2026-10-04 · Claude Code · Database and API**
- **What I asked:** to build the database before deploying.
- **What it gave back:** five tables owned by Neon Auth users (`npm run db:setup`), and an Express API: `auth.js` checks the login token, `validate.js` checks every input, and `routes/` covers restaurants, visits and boxes with parameterized queries and one transaction per ticket. The React app now loads and saves through the API. It tested more than 30 API cases with two throwaway accounts, including that one user cannot see or change the other's data, plus a browser run with a page reload.
- **What I kept or changed, and why:** kept. Its tests caught that broken JSON returned a `500` instead of a `400`, which it fixed before I committed.
- **Commit:** [`1f5e870`](https://github.com/ShawnUriel/Dishboxd/commit/1f5e870)

**2026-10-04 · Claude Code · Google restaurant search and the "food menu"**
- **What I asked:** to set up the Google API for restaurants and food menus.
- **What it gave back:** before building, it checked Google's documentation and told me the Places API has no menus or dishes. It offered two replacements: dish suggestions from my own past visits, and a link to the restaurant's Google Maps page. It then built a backend route that calls Places Autocomplete (New) with the key kept on the server, filters to places to eat, limits each user to 30 searches a minute, and a search page where an exact name match goes first.
- **What I kept or changed, and why:** I chose both replacements, since a menu from Google was not possible. I created the Google Cloud key myself and restricted it to Places API (New). I had saved it in `.env` under the wrong name; it renamed the line without ever displaying the key. Live tests found that some real branches are hidden because Google labels them only as an "establishment", and the "add it yourself" card covers those.
- **Commit:** [`23d5ee4`](https://github.com/ShawnUriel/Dishboxd/commit/23d5ee4)

**2026-10-04 · Claude Code · Security re-check and splitting my commits**
- **What I asked:** to re-check my security checklist against the new code, and to commit my accounts, database and Google work as separate commits so each entry here links to its own.
- **What it gave back:** it re-ran every check (secrets in files and history, login on every route, two-user isolation, validation, errors, CORS, dependencies) and found two database gaps (rows 14 and 15). It also confirmed that another Google API refuses my key. While checking that each in-between commit builds, it set up temporary copies of the repo, and cleaning them up accidentally deleted my `node_modules` folders. It noticed, told me, and reinstalled them exactly from the lockfiles (`npm ci`, 0 vulnerabilities).
- **What I kept or changed, and why:** I kept rows 14 and 15 as honest "No" answers rather than calling them fine, and wrote down the fix I plan before deploying (a limited database role).
- **Commit:** [`4191b78`](https://github.com/HAU-6APSI/student-6apsi-2203-ShawnUriel/commit/4191b78) *(workspace)*

## 2. Where the AI got it wrong

**1. It filled my journal with made-up restaurants.**
- **What it gave me:** the first version of the styled UI came with made-up sample restaurants already in the journal.
- **What was wrong:** Dishboxd is a personal journal. A new user should start with an empty one and fill it themselves, and fake entries would have looked like real data in my demo.
- **What I did instead:** I told it there should be no data yet. The app now starts empty (`JournalProvider.jsx` starts from empty lists), with a message telling you how to log your first visit.
- **Commit:** [`b0ba43a`](https://github.com/ShawnUriel/Dishboxd/commit/b0ba43a)

**2. It misread my instruction and removed every input.**
- **What it gave me:** when I said "there shouldn't be inputs yet", meaning no data, it removed the forms and left a static page.
- **What was wrong:** the forms are the app. Without them nothing could be logged, which is the opposite of what I wanted.
- **What I did instead:** I explained what I meant: no data yet, but a user can already type, and a restaurant that is not on Google Maps must still be addable. It restored the forms from its backup and added the NEW "add it yourself" card (`ManualPlaceForm.jsx`).
- **Commit:** [`b0ba43a`](https://github.com/ShawnUriel/Dishboxd/commit/b0ba43a)

**3. Its screenshots did not show up on GitHub.**
- **What it gave me:** for my documentation, it put the screenshots inside the Markdown file as base64 image data.
- **What was wrong:** GitHub does not display images written that way, so my documentation showed no screenshots. I only noticed when I opened it on GitHub.
- **What I did instead:** I had it switch to real image files in `project/Documentation/` with relative links. They still did not show at first, because I had uploaded the images to a different folder than the links pointed to; they worked once the paths matched.
- **Commit:** [`1dc13ea`](https://github.com/HAU-6APSI/student-6apsi-2203-ShawnUriel/commit/1dc13ea) *(workspace)*

## 3. Who wrote what

### Code I wrote myself

> **To do (me):** name the part of the code I wrote myself, with the file, the commit, and my own explanation of what it does and why it is built that way. The course asks for at least a fifth of the project to be my own code.

### One AI-written piece I understand: `requireUser` in `backend/auth.js`

Commit [`1f5e870`](https://github.com/ShawnUriel/Dishboxd/commit/1f5e870). Claude Code wrote it, and I kept it unchanged.

`requireUser` is the middleware that guards every journal route. In `server.js` it sits in front of `/api/restaurants`, `/api/visits`, `/api/boxes` and `/api/places`, so none of their handlers runs unless it calls `next()`.

1. It reads the `Authorization` header and expects `Bearer <token>`. With no header, or a different scheme, it stops right there with `401 "Log in to continue."`.
2. The token is a JWT that Neon Auth signed when the user logged in. `jwtVerify` from the `jose` library checks its signature with Neon Auth's **public** keys, which `createRemoteJWKSet` downloads once from `/.well-known/jwks.json` and caches. My server never holds a secret that could create tokens, and passwords never reach it.
3. It only accepts the `EdDSA` algorithm. That blocks a known trick where an attacker changes the token's algorithm field (for example to `none`) to skip the signature check.
4. It requires the issuer and audience to be my Neon Auth origin, so a token made by another service, or for another app, is refused. `jwtVerify` also rejects expired tokens; Neon Auth's last 15 minutes, and the React app fetches a fresh one when it needs to.
5. If everything passes, it sets `req.userId` to the token's `sub` (the user's id) and calls `next()`. Any failure, such as a bad signature, a wrong issuer or an expired token, ends in `401 "Your session has expired. Log in again."`. It never says which check failed.

This is why the API trusts `req.userId` and never a user id sent in the request body: every query filters by `req.userId`, so a logged-in user cannot ask for someone else's journal by changing an id. My tests showed it: no token and a tampered token both got `401`, and a second account could not see or change the first account's data.
