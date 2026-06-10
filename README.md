# Nuvo — Weekly Operating Rhythm

Live at https://nuvoowneropsrhythm.netlify.app/ (Netlify site `nuvoowneropsrhythm`, siteId `ff016582-3be2-46bc-9a40-e06ecabc5804`).

Single-file React app (React 18 + babel-standalone, no build step) plus Netlify Functions and a Netlify Blobs store. Conrad Jones and Ben Pond sign in by picking their name — no accounts, by design.

## What it does

- **Weekly contracts** — each owner logs weekly outcomes, meeting, delegation, risk, support. Stored on Monday.com board `18399091870` via the `monday-proxy` function.
- **Weekly grading** (Grading tab) — each owner reports the key number for his OWN areas and grades only the OTHER owner's areas (A+ to C-, on/off track, reason, forward commitment). Saves as `tentative`. Grades measure each area's output, not the person; on/off track is independent of the letter.
- **Coach finalize** (link on the login screen) — Bruce's passcode-gated screen. Every field of every area is editable live in the Wednesday meeting, plus the private weekly system check. "Submit final" publishes the week. The passcode is checked server-side on every request.
- **Public feed** — `/api/scoreboard` serves finalized grades only (area, grade, status, key number — never the comment fields). The Partnership Scoreboard at https://nuvoscorecard.netlify.app/ (repo `bbaker-netizen/nuvoscoreboard`) renders it live.

## Layout

```
public/index.html            the whole front end
netlify/functions/
  grading.mjs                owner reads + tentative writes (enforces cross-grading)
  finalize.mjs               Bruce: check/save/final/delete, passcode from env var
  scoreboard.mjs             public read, final records only, CORS open
  monday-proxy.mjs           forwards Monday.com GraphQL with the server-held token
netlify.toml                 publish = public, functions dir
```

Grading data lives in Netlify Blobs (store `grading`): one JSON document per week under `week:YYYY-MM-DD`, each area record carrying `state: tentative | final`, plus a `weeks` index key.

## Environment variables (set on the Netlify site)

- `NUVO_FINALIZE_PASSCODE` — Bruce's finalize gate. Rotate in Netlify UI any time.
- `MONDAY_TOKEN` — Monday.com API token used by `monday-proxy`. Never put a token in `public/index.html`.

## Deploying

Push to `main` once the Netlify site is linked to this repo (build command: none, publish directory and functions come from `netlify.toml`; Netlify installs `@netlify/blobs` from package.json automatically). Until then: `npm install`, then deploy via the Netlify MCP `deploy-site` operation from a checkout of this repo.

## Ground rules carried through the code

- Alpha grades only (A+ … C-), no numeric scores anywhere public.
- No compensation, salary, bonus, or rating-of-people fields.
- Reason / forward commitment / communicate / system check are captured for the record and the meeting — never published.
