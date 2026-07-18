# Recovery Intelligence

**Understand your body, not just your metrics.**

Recovery Intelligence is the AI-powered analytics layer on top of your wearable — upload exports
from WHOOP, Apple Health, Fitbit, Garmin, Oura, Polar, Coros or Samsung Health and get
personalized insights, correlations, natural-language answers, coaching and experiments, all
computed from your own data.

## Features

- **Dashboard** — Recovery, Sleep, Heart, Activity and Lifestyle sections with trends,
  distributions, sleep stages, HR zones, training load and best/worst days.
- **AI Insights Engine** — runs a battery of pre-registered statistical hypotheses
  (sleep → HRV, alcohol → recovery, weekend effect, strain → sleep, travel → RHR, …) and
  surfaces only what clears the bar, each with confidence level, evidence, a visualization,
  a plain-English explanation and a suggested experiment.
- **Correlation Explorer** — scatter + trend line + honest interpretation for any metric pair,
  same-day or lagged.
- **Ask Your Health Data** — a chat interface whose answers are computed exclusively from the
  uploaded dataset, with the reasoning shown.
- **AI Coach** — morning briefing, weekly report, monthly review, ranked suggestions and
  personalized experiment ideas.
- **Health Timeline** — a git-history-style browser over every logged day.
- **Experiment Mode** — before/after analysis with effect sizes and p-values, explicitly
  distinguishing correlation from causation.
- **Health Report** — a print-optimized report (save as PDF) with scores, movers, insights and
  next steps.

## Privacy model

All parsing and analysis run **client-side in the browser**. Data is persisted only to
`localStorage` on the user's device; there is no server upload, no account, and a one-click
"delete everything." Uploaded health data is never used to train AI models.

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
