# Recovery Intelligence

**A personal health intelligence engine — it explains *why* your metrics changed.**

Your wearable records what happened. Recovery Intelligence connects those metrics to your real
life — calendar, meetings, travel, training, late nights — and answers the question every
wearable user actually has: *"What in my life is causing these changes?"*

Upload exports from WHOOP, Apple Health, Fitbit, Garmin, Oura, Polar, Coros or Samsung Health,
connect Google Calendar or Apple Calendar (.ics), and get life-context insights, correlations,
natural-language answers, coaching and experiments — all computed locally from your own data.

## Features

- **Live device connections** — connect **WHOOP, Oura or Fitbit** via OAuth and auto-sync every
  visit, no file exports. Serverless routes handle the OAuth handshake (PKCE + CSRF state), hold
  tokens in httpOnly cookies, and normalize each provider's API into the shared day-record model;
  synced data is stored only in the browser. A no-setup **simulated sync** demonstrates the whole
  connect → sync → dashboard flow. Apple Health / Bevel / Garmin remain export-based (a web app
  can't reach them directly) and route to the uploader.
- **Calendar Intelligence** — connect Google/Apple Calendar via .ics export (parsed locally).
  Events are auto-classified (meetings, flights, social, workouts, study) and materialized into
  per-day features: meeting count/minutes, first-meeting time, back-to-back blocks, evening
  events, office vs WFH, travel days. The whole analytics stack cross-references them with HRV,
  RHR, recovery, sleep and strain.
- **AI Discovery Engine** — continuously runs pre-registered statistical hypotheses (meeting
  load → HRV, first-meeting time → recovery, evening events → sleep, 3 consecutive high-strain
  days → recovery, afternoon vs morning workouts, best training weekday, alcohol → HRV, travel →
  RHR, …) and surfaces only what clears the bar — each with a confidence level, supporting-data
  count, visualization, plain-English explanation, suggested experiment, and an explicit
  correlation-not-causation caveat.
- **Unified Timeline** — schedule and biology on one axis: every day shows calendar events,
  workouts, sleep, recovery, nutrition, travel, mood and notes.
- **Conversational Analytics** — "Do early meetings affect my sleep?", "What usually happens
  after I travel?", "Does working from home improve recovery?" — answered from the user's own
  data with reasoning shown and uncertainty acknowledged.
- **Dashboard** — Recovery, Sleep, Heart, Activity, Lifestyle and Work & Life sections.
- **Correlation Explorer** — scatter + trend line + honest interpretation for any metric pair
  (including calendar metrics), same-day or lagged.
- **AI Coach** — morning briefing, weekly report, monthly review, ranked suggestions and
  personalized experiment ideas.
- **Experiment Mode** — before/after analysis with effect sizes and p-values, explicitly
  distinguishing correlation from causation.
- **Health Report** — a print-optimized report (save as PDF) with scores, movers, insights and
  next steps.

## Privacy model

All parsing and analysis run **client-side in the browser** — including calendar files. Data is
persisted only to `localStorage` on the user's device; there is no server upload, no account,
and a one-click "delete everything." Uploaded health and calendar data is never used to train
AI models.

## Live connections setup (WHOOP / Oura / Fitbit)

Live sync works on any deployment once you register a developer app per provider and add its
credentials as environment variables. For each provider:

1. Create an app in its developer console (WHOOP: `developer.whoop.com`, Oura:
   `cloud.ouraring.com/oauth/applications`, Fitbit: `dev.fitbit.com/apps`).
2. Set the redirect/callback URL to `https://<your-domain>/api/oauth/<provider>/callback`.
3. Add env vars in Vercel (Project → Settings → Environment Variables) and redeploy:
   - `WHOOP_CLIENT_ID` / `WHOOP_CLIENT_SECRET`
   - `OURA_CLIENT_ID` / `OURA_CLIENT_SECRET`
   - `FITBIT_CLIENT_ID` / `FITBIT_CLIENT_SECRET`
   - optional `APP_URL` to pin the redirect base (otherwise derived from the request origin)

Without credentials, each provider card shows an in-app setup guide, and the **simulated sync**
still works with zero configuration. OAuth secrets are read only in server-side route handlers
(`src/app/api/oauth/*`, `src/app/api/sync/*`) and never shipped to the browser.

## Extending

- **Live providers** live in `src/lib/connections/` — client-safe metadata in `registry.ts`,
  server OAuth config in `server/config.ts`, and one `server/<provider>.ts` mapper per API that
  returns `DayRecord[]`. Add a provider by extending those three.
- **Data providers** live in `src/lib/parsers/` — implement `Provider`
  (`detect(file) → confidence`, `parse(files) → DayRecord[]`) and register it in `index.ts`.
- **Calendar** lives in `src/lib/calendar/` — `ics.ts` (RFC 5545 parsing + basic RRULE
  expansion), `classify.ts` (keyword event classifier), `features.ts` (per-day feature
  materialization). OAuth-based live sync can be layered on by feeding fetched events through
  the same `CalendarEvent` shape.
- **Hypotheses** live in `src/lib/insights.ts` — add a `CompareSpec` or `CorrSpec` and the
  discovery engine, coach and report pick it up automatically.

## Tech stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Framer Motion · Recharts · Zustand ·
JSZip. Deployable to Vercel with zero configuration.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000. Use **Demo Dashboard** for six months of realistic generated data,
or upload your own exports at `/upload`.

## Adding a data provider

Parsers live in `src/lib/parsers/`. Implement the `Provider` interface
(`detect(file) → confidence`, `parse(files) → DayRecord[]`) and register it in
`src/lib/parsers/index.ts`. WHOOP CSVs, Apple Health XML and a keyword-mapped generic
CSV/JSON adapter (covering Fitbit/Garmin/Oura-style exports) are included.

## Disclaimer

Recovery Intelligence is a data analysis tool, not a medical device. It reports patterns and
correlations in your own data; it does not diagnose, treat or replace professional medical
advice.
