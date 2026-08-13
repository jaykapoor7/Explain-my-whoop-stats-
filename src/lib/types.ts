/**
 * Health OS domain model. Designed to map cleanly onto a future Prisma /
 * PostgreSQL schema. Wearable fields are populated only from a real Google
 * Health sync (see src/lib/fitbit/server.ts) — there is no sample or demo
 * data anywhere in the app. Everything is keyed by an ISO date (YYYY-MM-DD)
 * so the whole app can be assembled into one unified per-day timeline.
 */

export type ISODate = string; // YYYY-MM-DD

export type Domain = "energy" | "recovery" | "sleep" | "strain" | "nutrition";

// ---------------- Wearable primitives ----------------

export interface HeartRateSample {
  t: string; // ISO datetime
  bpm: number;
}

export interface HRVMeasurement {
  date: ISODate;
  rmssdMs: number; // overnight rMSSD
  nonRemHrBpm?: number; // real overnight (non-REM) heart rate, when reported
}

export interface RestingHeartRate {
  date: ISODate;
  bpm: number;
}

export type SleepStageKind = "awake" | "light" | "deep" | "rem";

export interface SleepStage {
  kind: SleepStageKind;
  minutes: number;
}

/** A single contiguous stage block during the night (for the hypnogram). */
export interface SleepSegment {
  start: string; // local ISO datetime
  end: string;
  stage: SleepStageKind;
}

export interface SleepSession {
  date: ISODate; // the morning you woke on
  bedtime: string; // ISO datetime
  wake: string; // ISO datetime
  inBedMin: number;
  asleepMin: number;
  efficiencyPct: number; // asleep / in-bed
  stages: Record<SleepStageKind, number>; // minutes
  awakenings: number;
  sleepHrBpm: number; // avg overnight HR
  overnightHrvMs: number;
  consistencyPct: number; // bed/wake regularity vs baseline
  debtMin: number; // rolling shortfall vs need
  needMin: number;
  segments?: SleepSegment[]; // per-stage timeline for the hypnogram
}

export type ActivityConfidence = "high" | "medium" | "low";

export interface Activity {
  id: string;
  date: ISODate;
  type: string; // "Football", "Running", "Walking", "Gym", "Unrecognized"
  start: string; // ISO datetime
  durationMin: number;
  avgHr: number;
  maxHr: number;
  calories: number;
  zones: number[]; // minutes in zones 1..5
  load: number; // per-activity strain contribution (0..21 scale)
  confidence: ActivityConfidence;
  /** low-confidence blocks the user can Confirm / Edit / Ignore */
  resolved?: "confirmed" | "ignored" | "edited";
}

// ---------------- Nutrition ----------------

export interface NutritionFood {
  id: string;
  name: string;
  serving: string; // "100 g", "1 cup"
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number; // mg
}

export type MealKind = "breakfast" | "lunch" | "dinner" | "snack";

export interface MealItem {
  food: NutritionFood;
  servings: number;
}

export interface Meal {
  id: string;
  date: ISODate;
  kind: MealKind;
  time?: string;
  items: MealItem[];
}

export interface NutritionTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

// ---------------- Medication ----------------

export type MedFrequency = "once" | "twice" | "thrice" | "as-needed";

export interface Medication {
  id: string;
  name: string;
  dose: string; // "10 mg"
  frequency: MedFrequency;
  times: string[]; // ["08:00", "20:00"]
  withFood: "with" | "without" | "either";
  startDate: ISODate;
  endDate?: ISODate;
  notes?: string;
}

export type MedStatus = "taken" | "skipped" | "delayed" | "pending";

export interface MedicationEvent {
  id: string;
  medicationId: string;
  date: ISODate;
  scheduled: string; // "08:00"
  status: MedStatus;
  takenAt?: string; // actual time when taken/delayed
}

// ---------------- Journal ----------------

export interface JournalRatings {
  mood: number; // 1..10
  stress: number;
  energy: number;
  focus: number;
  sleepQuality: number;
}

export interface JournalTag {
  label: string; // "Smoking", "Caffeine", "Alcohol", "Football", "Studying"...
  intensity?: number; // 1..5 or count
  durationMin?: number;
  notes?: string;
}

export interface JournalEntry {
  date: ISODate;
  ratings: JournalRatings;
  tags: JournalTag[];
  note?: string;
}

// ---------------- Planner ----------------

export type TaskPriority = "low" | "medium" | "high";
export type TaskKind = "task" | "class" | "exam" | "assignment" | "work" | "event" | "workout";

export interface PlannerTask {
  id: string;
  date: ISODate;
  title: string;
  kind: TaskKind;
  start?: string; // "14:00"
  estMin?: number;
  priority: TaskPriority;
  done: boolean;
  recurring?: "daily" | "weekly" | "weekdays";
  notes?: string;
  todo?: boolean; // true = undated backlog item (lives in the to-do list, not a day)
}

// ---------------- Goals ----------------

export type GoalKind =
  | "weight"
  | "calories"
  | "protein"
  | "sleep"
  | "steps"
  | "training"
  | "academic";

export interface Goal {
  id: string;
  kind: GoalKind;
  label: string;
  target: number;
  unit: string;
  direction: "at-least" | "at-most" | "hit";
  domain?: Domain;
}

// ---------------- Baselines & scores ----------------

export interface PersonalBaseline {
  hrvMs: number;
  rhrBpm: number;
  sleepMin: number;
  sleepEffPct: number;
  strain: number;
  steps: number;
  energy: number;
  recovery: number;
}

export type ContributorKind = "positive" | "negative" | "neutral";

export interface Contributor {
  label: string;
  points: number; // signed
  kind: ContributorKind;
  detail?: string;
}

export interface ScoreResult {
  domain: Domain | "energy" | "recovery" | "sleep" | "strain";
  score: number; // 0..100 (strain uses 0..21 -> see `scale`)
  scale: number; // 100 or 21
  status: string; // "Primed", "Adequate", "Compromised"...
  deltaVsYesterday: number;
  baseline: number;
  contributors: Contributor[];
  explanation: string;
  /** false when the underlying data for this pillar wasn't synced for the day.
   * The score is meaningless then and the UI shows "No data" instead of a number. */
  available?: boolean;
}

export type EnergyScore = ScoreResult;
export type RecoveryScore = ScoreResult;
export type SleepScore = ScoreResult;
export type StrainScore = ScoreResult;

// ---------------- The unified day ----------------

export interface DailySummary {
  date: ISODate;
  hrv: HRVMeasurement;
  rhr: RestingHeartRate;
  sleep: SleepSession;
  activities: Activity[];
  steps: number;
  activeCalories: number;
  restingCalories: number;
  meals: Meal[];
  medicationEvents: MedicationEvent[];
  journal?: JournalEntry;
  weightKg?: number;
}

export interface Dataset {
  days: DailySummary[]; // chronological, oldest -> newest
  medications: Medication[];
  planner: PlannerTask[];
  goals: Goal[];
  profile: { name: string; device: string };
}
