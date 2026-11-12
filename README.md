# CURA

CURA turns Fitbit and Google Health data into four daily scores (recovery, sleep, strain and energy) and shows what raised or lowered each one. It is a personal wellness tool, not a medical device.

Live: https://explain-my-whoop-stats.vercel.app/

## What it does

- **Four daily scores.** Each score is a sum of signed contributions (for example "HRV +13", "Sleep debt −11"), so the explanation is the calculation itself. Inputs are compared with your own rolling 14-day baseline, not population norms.
- **No phantom workouts.** Short heart-rate spikes are marked low confidence and left out of strain until you confirm, ignore or retype them.
- **Trends and patterns.** Compares your journal tags (caffeine, alcohol, late meals and so on) with your scores. A pattern is only shown once it clears a minimum sample size, always with `n`, and is worded as an association, never as a cause.
- **Logging tools.** Journal, nutrition (food search via Open Food Facts), medication schedule and adherence, a planner with WhatsApp reminders, and editable goals.
- **Extras.** A Health Age estimate, friend groups that compare headline scores, and an assistant that answers questions about your stats in the browser (no AI service is called).
- **Other wearables.** Manual entry for any device. Optional Oura, WHOOP and Polar connectors (Oura is mapped; the others connect but their data mapping is still in progress).

## How it handles your data

- Signing in with Google creates your CURA account and connects Google Health in one step. CURA asks for read-only health scopes and never writes to your Google data.
- Synced health data and everything you log is kept in your browser (`localStorage`).
- While you are signed in, a copy of that data is also saved to the server database so it syncs across your devices. Your Google refresh token is stored encrypted (AES-256-GCM) and the session cookie is signed and httpOnly.
- If you never sign in (for example, you enter numbers by hand), your data stays in your browser.
- If you use Friends, your headline recovery, sleep and strain scores are shared with the members of your groups.
- Settings has **Reset local data** (this browser) and **Delete account** (profile, stored token and cloud data).
- There are no analytics or ad trackers. The full policy is in the app at `/privacy`.

## Run it locally

```bash
npm install
npm run dev          # http://localhost:3000
```

The app runs with no environment variables set; see `.env.example` for all of them. Without `DATABASE_URL`, accounts and sync use a JSON file under `.data/` (single server only). Set `AUTH_SECRET` in production.

Google sign-in needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from a Google Cloud project with the **Google Health API** (`health.googleapis.com`) enabled:

1. On the OAuth consent screen, add these scopes, and add yourself as a test user while the app is in Testing (the scopes are Restricted, so public use needs Google's verification):

   ```
   https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly
   https://www.googleapis.com/auth/googlehealth.sleep.readonly
   https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly
   ```

2. Create a **Web application** OAuth client and register `http://localhost:3000/api/fitbit/callback` (plus your deployed origin's equivalent) as a redirect URI. Set `APP_URL` if the public origin differs from the request origin.

The first sync pulls the last 30 days.

Checks:

```bash
npm run typecheck
npm run lint
npm run build
npm run test:analytics   # analytics engine against synthetic users
```

## Where things live

- `src/lib/scoring`: the sleep, recovery, strain and energy calculators. They are hand-written heuristics, not clinically validated.
- `src/lib/analytics` and `src/lib/insights`: baselines, trends, events and pattern detection.
- `src/lib/fitbit`: Google Health OAuth (Authorization Code + PKCE), sync and field mapping.
- `src/app`: pages and API routes.
- `ios/CuraLockWidget`: an optional iPhone Lock Screen widget (SwiftUI + WidgetKit). See its README.

## Stack

Next.js 14 (App Router), TypeScript, Tailwind CSS, framer-motion, Recharts, Zustand, and Postgres (`pg`) for accounts and sync.

## Not medical advice

CURA reports patterns in your own data. It does not diagnose, and it never recommends starting, stopping or changing a medication or dose. Talk to a clinician about anything that concerns you.
