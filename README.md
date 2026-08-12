# Health OS

An open-source personal Health OS for your Fitbit Air.

Most health apps hand you a number and leave. Health OS is built around one rule:

> **Never just show a number.** Explain what it means, what pushed it up or down, and how it
> affected everything else.

Every score follows the same path:

```
DATA → SCORE → WHY → IMPACT → PERSONAL PATTERNS → ACTION
```

Your data is fetched from Google Health on demand and stored **in your browser only**. There is no
database, no account, and no server-side copy of your health data.

---

## Sections

| Section | What it answers |
| --- | --- |
| **Today** | What state am I in, and *what affected me*? A signed ledger (↑ Sleep +9, ↓ Late football −6) plus "Explain My Day". |
| **Energy** | How much usable capacity do I have right now? |
| **Recovery** | How prepared is my body for more stress? HRV, resting HR, sleep and yesterday's strain. |
| **Sleep** | How well did last night restore me? Stages, efficiency, debt, consistency — and how it rippled into today. |
| **Strain** | How much load did I take on? Per-activity breakdown with confidence gating. |
| **Nutrition** | Calories and macros (protein, carbs, fat, fiber, sugar, sodium) vs your goals, intake vs expenditure. |
| **Medication** | Your own schedule, reminders and adherence. Observational only — never advice. |
| **Journal** | Mood, stress, energy, focus and tags. The input side of personal experiments. |
| **Assistant** | Ask questions about your own stats in plain language. Runs entirely on-device. |
| **Trends** | Correlations and group comparisons across your history, always with sample sizes. |
| **Planner** | What's on today, and how it lines up with your capacity. |
| **Goals** | Editable targets that drive every other page's thresholds. |
| **Settings** | Connection, privacy, and a one-click wipe of everything. |

---

## The "no phantom workouts" rule

Wrist wearables mistake stress, caffeine, a hot shower or a bus sprint for exercise. Health OS
never silently turns a short HR spike into a workout.

Every detected activity carries a confidence level:

- **High / Medium** → counted toward strain normally.
- **Low** → shown, but **excluded from your strain score** until you resolve it with
  **Ignore**, **Confirm as workout**, or **Edit type**.

Your corrections are stored and are the intended training signal for better detection later.

---

## Scoring

Four independent calculators live in `src/lib/scoring/`:

- `sleep.ts` — duration vs personal need, efficiency, deep + REM share, timing consistency, awakenings
- `recovery.ts` — overnight HRV vs baseline, resting HR vs baseline, sleep score, yesterday's strain
- `strain.ts` — summed load of *counted* activities plus a movement term
- `energy.ts` — recovery, sleep debt, accumulated strain, nutrition and time of day

Each returns a `ScoreResult` with **signed contributors that sum to the score**, so the "why" is
never a post-hoc narration — it *is* the calculation. Baselines are rolling 14-day personal
baselines, not population norms.

> These are deliberate, deterministic placeholders. The final health algorithms are designed
> separately; nothing here is tuned or validated.

---

## Statistics honesty

`src/lib/insights/insights.ts` only reports patterns that clear a minimum sample size, and always
prints `n`. It uses Welch-style group comparisons and Pearson correlations, and it phrases every
finding observationally:

- "On days you logged *X*, your recovery averaged 6 points higher (n = 23)."
- **Never** "X causes Y", and **never** a recommendation about medication.

---

## Connecting your Fitbit (Google Health API)

Fitbit's developer surface has moved to the **Google Health API** with Google OAuth 2.0 — the
legacy Fitbit Web API is deprecated (sunset September 2026). This app targets the current API.

Open **Settings → Connect**, and the app walks you through it. In full:

### 1. Google Cloud APIs to enable

In the [Google Cloud console](https://console.cloud.google.com), create a project and enable:

- **Google Health API** (`health.googleapis.com`) — the only API required.

### 2. OAuth consent screen

- User type **External**.
- Add yourself under **Test users**. All `googlehealth.*` scopes are **Restricted**, so while the
  consent screen is in *Testing*, only listed test users can connect. Publishing to public users
  requires Google's verification review.
- Add these scopes:

```
https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly
https://www.googleapis.com/auth/googlehealth.sleep.readonly
https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly
```

All three are read-only. Health OS never writes to your Google Health data.

### 3. OAuth client

Create **Credentials → OAuth client ID → Web application**. The client ID ends in
`.apps.googleusercontent.com`.

**Authorized redirect URIs** — add every origin you use, exactly:

```
http://localhost:3000/api/fitbit/callback
https://<your-app>.vercel.app/api/fitbit/callback
```

**Authorized JavaScript origins** are not needed (this is a server-side code flow).

### 4. Environment variables

All optional — if unset, the app prompts for the client ID and secret in the UI and keeps them in
httpOnly cookies in your browser.

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Web OAuth client ID (`….apps.googleusercontent.com`) |
| `GOOGLE_CLIENT_SECRET` | Web OAuth client secret (`GOCSPX-…`) |
| `APP_URL` | Public origin, e.g. `https://your-app.vercel.app`. Used to build the redirect URI; must match a registered one. |

On Vercel: **Settings → Environment Variables**, applied to Production and Preview. See
`.env.example`.

### 5. What gets synced

`POST /api/fitbit/sync` pulls the last 30 days:

| Data | Google Health data type |
| --- | --- |
| Resting heart rate | `daily-resting-heart-rate` |
| HRV | `daily-heart-rate-variability` |
| Steps | `steps` (daily roll-up) |
| Calories | `total-calories` (daily roll-up, chunked to the documented 14-day cap) |
| Sleep sessions & stages | `sleep` |
| Workouts | `exercise` |
| Weight | `weight` |

The flow is Authorization Code + PKCE with `access_type=offline`; access and refresh tokens live in
httpOnly cookies and never reach the client bundle.

> **Field-mapping caveat:** per-data-type response field names for some types are not fully
> published, so the mapper probes several plausible field names and fails soft per field rather
> than dropping the whole day. If a metric reads as missing after your first real sync, that mapper
> is where to look.

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

```bash
npm run typecheck    # tsc --noEmit, strict
npm run lint
npm run build
```

Deploying to Vercel: import the repo, framework preset **Next.js** (pinned in `vercel.json`), add
the environment variables above, deploy.

---

## Phone widgets

Health OS is an installable PWA. On iPhone: open it in Safari → **Share → Add to Home Screen** for
a standalone icon. `/widget` is a compact, glanceable view of Energy, Recovery, Sleep and Strain
designed for that.

**An honest limit:** true iOS *lock screen* widgets require a native app using Apple's WidgetKit.
No web app of any kind can add one — that would need a companion iOS app, which this repo does not
include.

---

## Privacy

- Health data lives in `localStorage` in your browser. There is no database and no analytics.
- OAuth tokens and client credentials are httpOnly cookies, never exposed to client JavaScript.
- Medication, journal and health data are treated as sensitive: never logged, never transmitted
  anywhere except directly to Google's API for your own sync.
- **Settings → Clear all data** wipes everything, including stored credentials.
- No secrets or personal health data are committed to this repository.

---

## Stack

Next.js 14 (App Router) · TypeScript (strict) · Tailwind CSS · Recharts · Zustand · framer-motion

Business logic is kept out of the UI: `src/lib/scoring`, `src/lib/insights`, `src/lib/assistant`
and `src/lib/fitbit` are all independently testable and hold no React.

---

## Not medical advice

Health OS is a personal data tool, not a medical device. It reports patterns in your own data. It
does not diagnose, and it will never recommend starting, stopping, or changing any medication or
dose. Talk to a clinician about anything that concerns you.
