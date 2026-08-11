# Health OS

**An open-source personal Health OS for the Fitbit Air** — great hardware, better software.

Instead of just showing numbers, every screen follows one philosophy:

**DATA → SCORE → WHY → IMPACT → PERSONAL PATTERNS → ACTION**

Sleep, recovery, strain and energy each get a score, a plain-English explanation of *what moved
it*, how it rippled into the other scores, and what your own history says about it.

## Sections

Today · Energy · Recovery · Sleep · Strain · Nutrition · Medication · Journal · Trends/Insights ·
Planner · Goals · Settings

Highlights:

- **Today** — "How am I doing?" with an energy ring, the signed *What affected you* ledger
  (↑ Sleep +9 · ↑ HRV +4 · ↓ Football −6), and an expandable *Explain my day*.
- **Strain** — per-activity load breakdown with **activity confidence**: short unrecognized HR
  spikes are *never* counted as workouts until you Confirm / Edit / Ignore them.
- **Nutrition** — calorie + macro tracker (protein/carbs/fat/fiber/sugar/sodium), food search,
  custom foods, servings, intake vs expenditure, goal-based targets.
- **Medication** — schedule, taken/skipped/delayed logging, adherence history, and strictly
  observational associations ("Logged doses were associated with…"). Never recommends changing
  medication. Treated as sensitive data.
- **Journal** — mood/stress/energy/focus ratings plus behavior tags (smoking, caffeine, alcohol,
  football, studying…). Feeds the pattern engine: *"Across 18 logged instances, smoking was
  associated with 8% lower HRV."* Sample sizes always shown; causation never claimed.
- **Trends** — 7/30/90d metric explorer, behavior→physiology associations, and paired-metric
  correlations (Sleep↔Recovery, Exercise↔Sleep, Nutrition↔Energy…).
- **Planner & Goals** — day/week/month planner (tasks, classes, exams, work shifts) with an early
  health-aware nudge (high recovery → schedule the hard block), and goals that feed Today,
  Nutrition and the Planner.

## Architecture

- **Next.js 14 (App Router) · strict TypeScript · Tailwind · Recharts · Zustand**
- **Unified timeline**: everything (wearable, meals, meds, journal, planner) keys off one
  `DailySummary` per date — enabling EVENT → PHYSIOLOGY → RECOVERY → NEXT-DAY OUTCOME analysis.
- **Providers** (`src/lib/data/provider.ts`): `HealthDataProvider` interface with a
  `MockHealthDataProvider` shipping 90 days of deterministic, physiologically-plausible data.
  A `GoogleHealthProvider` (Fitbit Air) implements the same interface next — no UI or scoring
  changes required. Extensible to Apple Health / Garmin / WHOOP / Oura.
- **Calculators** (`src/lib/scoring/`): separate `EnergyCalculator`, `RecoveryCalculator`,
  `SleepScoreCalculator`, `StrainCalculator` with deterministic placeholder weights — every score
  decomposes into signed contributors that sum to the value shown. **Final algorithms are
  deliberately not designed yet.**
- **User state** (`src/lib/data/store.ts`): only user actions are persisted (localStorage);
  the mock regenerates deterministically. Maps cleanly onto a future PostgreSQL/Prisma schema.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck && npm run lint && npm run build
```

## Privacy

No secrets or real personal health data in the repo. Credentials go in env vars. Medication,
journal and health data are treated as sensitive — local-only in this build, excluded from any
future analytics by default. Not a medical device; nothing here is medical advice.
