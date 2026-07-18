/** Core data model. Every provider parser normalizes into these shapes. */

export interface Workout {
  date: string; // YYYY-MM-DD
  sport: string;
  durationMin: number;
  strain?: number;
  calories?: number;
  avgHr?: number;
  maxHr?: number;
  startHour?: number; // local hour of day, 0-23 (fractional ok)
  /** minutes spent in each HR zone, zone 1..5 */
  zones?: number[];
}

export interface DayRecord {
  date: string; // YYYY-MM-DD

  // Recovery
  recovery?: number; // 0-100
  hrv?: number; // ms (rMSSD)
  rhr?: number; // bpm
  spo2?: number;
  skinTempC?: number;
  respiratoryRate?: number;

  // Sleep (for the night ending this morning)
  sleepHours?: number;
  sleepNeedHours?: number;
  sleepDebtHours?: number;
  sleepEfficiency?: number; // 0-100
  sleepConsistency?: number; // 0-100
  deepHours?: number;
  remHours?: number;
  lightHours?: number;
  awakeHours?: number;
  bedtimeHour?: number; // 0-30 scale where 25 = 1am next day, keeps ordering monotonic
  wakeHour?: number;

  // Activity
  strain?: number; // 0-21 (WHOOP scale; other providers mapped)
  steps?: number;
  calories?: number;
  activeCalories?: number;
  maxHr?: number;
  workouts?: Workout[];

  // Lifestyle (journal / manual)
  alcoholDrinks?: number;
  caffeineMg?: number;
  lateCaffeine?: boolean;
  stress?: number; // 1-10
  mood?: number; // 1-10
  proteinG?: number;
  calorieIntake?: number;
  screenTimeMin?: number;
  travel?: boolean;
  sauna?: boolean;
  meditation?: boolean;
  notes?: string;
}

export type MetricKey =
  | "recovery"
  | "hrv"
  | "rhr"
  | "sleepHours"
  | "sleepEfficiency"
  | "sleepConsistency"
  | "sleepDebtHours"
  | "deepHours"
  | "remHours"
  | "strain"
  | "steps"
  | "calories"
  | "maxHr"
  | "bedtimeHour"
  | "alcoholDrinks"
  | "caffeineMg"
  | "stress"
  | "mood"
  | "proteinG"
  | "calorieIntake"
  | "screenTimeMin";

export interface MetricMeta {
  key: MetricKey;
  label: string;
  shortLabel: string;
  unit: string;
  color: string;
  /** true when a higher value is generally desirable */
  higherIsBetter: boolean | null;
  decimals: number;
}

export const METRICS: Record<MetricKey, MetricMeta> = {
  recovery: { key: "recovery", label: "Recovery score", shortLabel: "Recovery", unit: "%", color: "#199e70", higherIsBetter: true, decimals: 0 },
  hrv: { key: "hrv", label: "Heart rate variability", shortLabel: "HRV", unit: "ms", color: "#3987e5", higherIsBetter: true, decimals: 0 },
  rhr: { key: "rhr", label: "Resting heart rate", shortLabel: "RHR", unit: "bpm", color: "#e66767", higherIsBetter: false, decimals: 0 },
  sleepHours: { key: "sleepHours", label: "Sleep duration", shortLabel: "Sleep", unit: "h", color: "#9085e9", higherIsBetter: true, decimals: 1 },
  sleepEfficiency: { key: "sleepEfficiency", label: "Sleep efficiency", shortLabel: "Efficiency", unit: "%", color: "#6da7ec", higherIsBetter: true, decimals: 0 },
  sleepConsistency: { key: "sleepConsistency", label: "Sleep consistency", shortLabel: "Consistency", unit: "%", color: "#d55181", higherIsBetter: true, decimals: 0 },
  sleepDebtHours: { key: "sleepDebtHours", label: "Sleep debt", shortLabel: "Sleep debt", unit: "h", color: "#c98500", higherIsBetter: false, decimals: 1 },
  deepHours: { key: "deepHours", label: "Deep sleep", shortLabel: "Deep", unit: "h", color: "#1c5cab", higherIsBetter: true, decimals: 1 },
  remHours: { key: "remHours", label: "REM sleep", shortLabel: "REM", unit: "h", color: "#9085e9", higherIsBetter: true, decimals: 1 },
  strain: { key: "strain", label: "Day strain", shortLabel: "Strain", unit: "", color: "#d95926", higherIsBetter: null, decimals: 1 },
  steps: { key: "steps", label: "Steps", shortLabel: "Steps", unit: "", color: "#199e70", higherIsBetter: true, decimals: 0 },
  calories: { key: "calories", label: "Calories burned", shortLabel: "Cal burn", unit: "kcal", color: "#c98500", higherIsBetter: null, decimals: 0 },
  maxHr: { key: "maxHr", label: "Max heart rate", shortLabel: "Max HR", unit: "bpm", color: "#d03b3b", higherIsBetter: null, decimals: 0 },
  bedtimeHour: { key: "bedtimeHour", label: "Bedtime", shortLabel: "Bedtime", unit: "", color: "#9085e9", higherIsBetter: false, decimals: 1 },
  alcoholDrinks: { key: "alcoholDrinks", label: "Alcohol", shortLabel: "Alcohol", unit: "drinks", color: "#e66767", higherIsBetter: false, decimals: 1 },
  caffeineMg: { key: "caffeineMg", label: "Caffeine", shortLabel: "Caffeine", unit: "mg", color: "#c98500", higherIsBetter: null, decimals: 0 },
  stress: { key: "stress", label: "Stress", shortLabel: "Stress", unit: "/10", color: "#d95926", higherIsBetter: false, decimals: 1 },
  mood: { key: "mood", label: "Mood", shortLabel: "Mood", unit: "/10", color: "#199e70", higherIsBetter: true, decimals: 1 },
  proteinG: { key: "proteinG", label: "Protein intake", shortLabel: "Protein", unit: "g", color: "#3987e5", higherIsBetter: true, decimals: 0 },
  calorieIntake: { key: "calorieIntake", label: "Calorie intake", shortLabel: "Intake", unit: "kcal", color: "#c98500", higherIsBetter: null, decimals: 0 },
  screenTimeMin: { key: "screenTimeMin", label: "Screen time", shortLabel: "Screen", unit: "min", color: "#898781", higherIsBetter: false, decimals: 0 },
};

export const METRIC_LIST = Object.values(METRICS);

export interface ChartPoint {
  x: number;
  y: number;
  date: string;
}

export type InsightCategory =
  | "sleep"
  | "recovery"
  | "heart"
  | "activity"
  | "lifestyle"
  | "trend";

export interface Insight {
  id: string;
  category: InsightCategory;
  headline: string;
  confidence: "high" | "moderate" | "exploratory";
  confidenceScore: number; // 0-1
  evidence: string[];
  explanation: string;
  experiment: string;
  chart:
    | { kind: "scatter"; xKey: MetricKey; yKey: MetricKey; points: ChartPoint[]; trend?: { slope: number; intercept: number } }
    | { kind: "compare"; groups: { label: string; value: number; n: number }[]; metric: MetricKey }
    | { kind: "trend"; metric: MetricKey; points: { date: string; value: number }[] };
  stats: { n: number; r?: number; p?: number; effect?: number };
}

export interface Experiment {
  id: string;
  name: string;
  description: string;
  startDate: string; // YYYY-MM-DD
  targetMetrics: MetricKey[];
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  chart?: Insight["chart"];
  timestamp: number;
}

export interface DatasetMeta {
  source: string; // "Demo", "WHOOP", "Fitbit", ...
  fileNames: string[];
  importedAt: string;
}
