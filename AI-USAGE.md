# AI usage

I built Dishboxd with a lot of help from AI, mostly **Claude Code** (Anthropic's coding assistant), plus an AI chat tool once in Week 1. Claude Code wrote most of the code in this repository. My part was the idea and the README, the design system and wireframes it built from, the decisions written down below, checking its work in the browser, and catching the times it went the wrong way. Section 3 says which code is mine.

Commit links go to this repository. The links marked *(workspace)* go to my private course workspace, where my documentation and security checklist live. Those private links need course-workspace access; they returned 404 during this review, so they have not been independently verified here.

This log began in Week 1, rather than being created only for the final submission: [`52d3086`](https://github.com/ShawnUriel/Dishboxd/commit/52d3086c32b49757dd74c1faf2286262157277f0) introduced it, [`b0ba43a`](https://github.com/ShawnUriel/Dishboxd/commit/b0ba43a44f96b9928d40c6ad6a44c0ab709a96e7) expanded it in Week 2, [`5ee6c58`](https://github.com/ShawnUriel/Dishboxd/commit/5ee6c58a9376208baa23900eebef9c89741dd438) recorded the history cleanup, and [`527c89c`](https://github.com/ShawnUriel/Dishboxd/commit/527c89c00592c8efa5c555fa594a524587b498ca) organised the three badge sections and README credit. The cleanup rewrote history, so the original activity date and a rewritten commit's committer date can differ.

For this update, ChatGPT helped review the existing log against the repository history and clarify the contribution evidence. Earlier prompts, browser checks and test runs below are accounts already recorded in the log, not new tests performed for this documentation update. The full unit lesson and rubric have not been supplied for this review; the checks are against the assignment brief. Section 3 still needs my own code examples and explanations before the required 20% can be established.

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
- **What I kept or changed, and why:** I checked the report against what I had actually built and had the screenshots redone as real image files (section 2, case 5).
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
- **What I kept or changed, and why:** kept. Its tests caught that broken JSON returned a `500` instead of a `400`, which it fixed before I committed (section 2, case 4). The initial `require('jose')` also needed a later deployment fix to `import('jose')` (section 2, case 3). I count both corrections as problems with the AI-written backend.
- **Commits:** initial API [`1f5e870`](https://github.com/ShawnUriel/Dishboxd/commit/1f5e8707a7983cd04fc07405d955e12694a55c17), clearer startup configuration errors [`f75061f`](https://github.com/ShawnUriel/Dishboxd/commit/f75061ff755af128fad2a20cf3e3b7349de0de89), module-loading correction [`654fe89`](https://github.com/ShawnUriel/Dishboxd/commit/654fe89203cf49d6ce1281cf9b6859cd175db131)

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

**3. The AI-written authentication module failed during deployment.**
- **What it gave me:** `backend/auth.js` loaded `jose` using `require('jose')`, although the backend is CommonJS and this version of `jose` is an ES module.
- **What was wrong:** the original import did not work with the deployed loader. The correction commit records a Vercel startup failure reported as "argument handler must be a function". Working in the local runtime had not established that the same module would load when deployed.
- **What changed:** the fix loads `jose` with `import('jose')`, creates a shared `verifierReady` promise, and awaits that verifier in `requireUser`. Loading failures are logged and flow to the server error handler; invalid login tokens still return `401`. The configuration-check commit also makes missing or invalid environment URLs easier to diagnose.
- **Why the correction matters:** a login failure is different from a server startup failure, and local behaviour alone does not establish deployment compatibility. The diff proves the correction; it does not prove that I personally wrote the fix or that a later deployment succeeded.
- **Commits:** original AI-written module [`1f5e870`](https://github.com/ShawnUriel/Dishboxd/commit/1f5e8707a7983cd04fc07405d955e12694a55c17), configuration diagnostics [`f75061f`](https://github.com/ShawnUriel/Dishboxd/commit/f75061ff755af128fad2a20cf3e3b7349de0de89), corrected module loading [`654fe89`](https://github.com/ShawnUriel/Dishboxd/commit/654fe89203cf49d6ce1281cf9b6859cd175db131)

**4. Invalid JSON was treated as a server failure.**
- **What it gave me:** an error-handling path that returned `500` when the request body was broken JSON.
- **What was wrong:** a malformed request is a client error. Returning `500` made it look as though the server had failed and gave the caller the wrong status.
- **What changed:** `backend/server.js` checks Express's `entity.parse.failed` error and returns `400` with "The request body is not valid JSON." The same handler treats an oversized body as `413` and keeps unexpected errors as a generic `500`.
- **What caught it:** the AI's API tests caught this before the API commit, as recorded in section 1. I accepted the correction; I do not claim I independently discovered or hand-wrote it. The commit contains the corrected handler, not a separately committed broken version.
- **Commit:** [`1f5e870`](https://github.com/ShawnUriel/Dishboxd/commit/1f5e8707a7983cd04fc07405d955e12694a55c17)

**5. Its screenshots did not show up on GitHub.**
- **What it gave me:** for my documentation, it put the screenshots inside the Markdown file as base64 image data.
- **What was wrong:** GitHub does not display images written that way, so my documentation showed no screenshots. I only noticed when I opened it on GitHub.
- **What I did instead:** I had it switch to real image files in `project/Documentation/` with relative links. They still did not show at first, because I had uploaded the images to a different folder than the links pointed to; they worked once the paths matched.
- **Commit:** [`1dc13ea`](https://github.com/HAU-6APSI/student-6apsi-2203-ShawnUriel/commit/1dc13ea) *(workspace)*

## 3. Who wrote what

### Code I wrote myself

**Evidence still needed:** I have not yet identified and explained a verified set of code I wrote myself. I cannot claim that the required fifth is complete from this log alone. My ideas, designs, instructions, testing and decisions matter, but they do not establish that I personally wrote 20% of the application's code. A commit under my GitHub name also does not establish that: the AI-generated work was committed under my name too.

For each part I actually wrote, I need to add its exact file and functions, a commit link showing the code, and an explanation in my own words of how it works, why I chose that approach, and how I checked it. I also need to say whether AI supplied any of that code and explain how the identified parts amount to at least a fifth of the app. I will not count AI-generated code as my own just because I reviewed or understood it.

**Commit showing the attribution gap:** [`527c89c`](https://github.com/ShawnUriel/Dishboxd/commit/527c89c00592c8efa5c555fa594a524587b498ca) already left this section unfinished while recording that Claude Code wrote most of the project. This update makes the missing evidence explicit rather than inventing an authorship claim.

### Recorded responsibilities and AI-written code

| Part | Recorded contribution | Commit evidence |
| --- | --- | --- |
| Project idea, README, design system and wireframes | My direction and design input, as described in the existing log. Claude Code generated the implementation from them. These are not claimed as independently written application code. | [Initial README](https://github.com/ShawnUriel/Dishboxd/commit/c799d05809b618ce34a45f931d24058f6b02c0b9), [styled UI](https://github.com/ShawnUriel/Dishboxd/commit/b0ba43a44f96b9928d40c6ad6a44c0ab709a96e7) |
| Empty journal and working forms | I corrected the requirements; Claude Code removed sample entries and restored the forms. | [UI and forms](https://github.com/ShawnUriel/Dishboxd/commit/b0ba43a44f96b9928d40c6ad6a44c0ab709a96e7), [README follow-up](https://github.com/ShawnUriel/Dishboxd/commit/890715eba2c1fbe0bcc889864fe0c22da7083b8f) |
| Accounts and protected frontend routes | I chose Neon Auth and required verified email; Claude Code implemented the account pages and login checks. | [Accounts](https://github.com/ShawnUriel/Dishboxd/commit/66bb77676183f5a98789dfd690d7e72a48b44160) |
| Express API, validation and Postgres persistence | Claude Code generated the database, authenticated routes, parameterized queries and transaction handling. Understanding them is separate from having written them myself. | [Database and API](https://github.com/ShawnUriel/Dishboxd/commit/1f5e8707a7983cd04fc07405d955e12694a55c17) |
| Google restaurant search and dish suggestions | I created and restricted the API key and chose the alternatives to unavailable Google menu data; Claude Code implemented the search and suggestions. | [Google integration](https://github.com/ShawnUriel/Dishboxd/commit/23d5ee49a10b4fd2c79dd36c6d48d709d69581a0) |
| AI usage documentation | Claude Code helped draft the earlier log; ChatGPT helped review and clarify this update using existing records. Neither drafting step proves manual code authorship. | [Earlier log and README credit](https://github.com/ShawnUriel/Dishboxd/commit/527c89c00592c8efa5c555fa594a524587b498ca) |

### One AI-written piece I understand: `requireUser` in `backend/auth.js`

Original implementation: [`1f5e870`](https://github.com/ShawnUriel/Dishboxd/commit/1f5e8707a7983cd04fc07405d955e12694a55c17). Claude Code wrote it. The module-loading approach was later corrected in [`654fe89`](https://github.com/ShawnUriel/Dishboxd/commit/654fe89203cf49d6ce1281cf9b6859cd175db131). This explanation demonstrates understanding of AI-written code; it is not a claim that I wrote it myself.

`requireUser` is the middleware that guards every journal route. In `server.js` it sits in front of `/api/restaurants`, `/api/visits`, `/api/boxes` and `/api/places`, so none of their handlers runs unless it calls `next()`.

1. It reads the `Authorization` header and expects `Bearer <token>`. With no header, or a different scheme, it stops right there with `401 "Log in to continue."`.
2. The token is a JWT that Neon Auth signed when the user logged in. The server loads `jose` using `import()` and shares the resulting verifier through `verifierReady`. `jwtVerify` checks the signature using Neon Auth's **public** keys, which `createRemoteJWKSet` fetches from `/.well-known/jwks.json` and caches. The server does not hold Neon's token-signing private key, and the login password is handled by Neon Auth.
3. It only accepts the `EdDSA` algorithm. Tokens declaring a different algorithm, including unsigned `none` tokens, are rejected; signature verification still has to succeed with Neon's public keys.
4. It requires the issuer and audience to be my Neon Auth origin, so a token made by another service, or for another app, is refused. `jwtVerify` also rejects expired tokens; Neon Auth's last 15 minutes, and the React app fetches a fresh one when it needs to.
5. If everything passes, it requires a `sub` claim, sets `req.userId` to that value (the user's id) and calls `next()`. A token verification failure, such as a bad signature, a wrong issuer or an expired token, ends in `401 "Your session has expired. Log in again."`. It never says which token check failed. A failure to load `jose` happens outside that token-check `try` block and reaches Express's server error handler as `500` instead.

This is why the API trusts `req.userId` and never a user id sent in the request body: every query filters by `req.userId`, so a logged-in user cannot ask for someone else's journal by changing an id. My tests showed it: no token and a tampered token both got `401`, and a second account could not see or change the first account's data.
