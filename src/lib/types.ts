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

export type EventType =
  | "meeting"
  | "social"
  | "travel"
  | "workout"
  | "study"
  | "personal"
  | "vacation";

export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD (local start date)
  title: string;
  type: EventType;
  startHour: number; // fractional local hour
  endHour: number;
  durationMin: number;
  location?: string;
  allDay?: boolean;
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
  carbsG?: number;
  fatG?: number;
  calorieIntake?: number;
  screenTimeMin?: number;
  travel?: boolean;
  sauna?: boolean;
  meditation?: boolean;
  notes?: string;

  // Calendar-derived context (materialized by enrichDaysWithCalendar)
  meetingCount?: number;
  meetingMinutes?: number;
  firstMeetingHour?: number;
  backToBackMeetings?: number;
  eveningEventHour?: number; // latest end of an evening event, if any
  hasEveningEvent?: boolean;
  hasFlight?: boolean;
  officeDay?: boolean; // true = at least one in-person meeting location
  workday?: boolean;
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
  | "carbsG"
  | "fatG"
  | "calorieIntake"
  | "screenTimeMin"
  | "meetingCount"
  | "meetingMinutes"
  | "firstMeetingHour";

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
  recovery: { key: "recovery", label: "Recovery score", shortLabel: "Recovery", unit: "%", color: "#34d399", higherIsBetter: true, decimals: 0 },
  hrv: { key: "hrv", label: "Heart rate variability", shortLabel: "HRV", unit: "ms", color: "#4d9fff", higherIsBetter: true, decimals: 0 },
  rhr: { key: "rhr", label: "Resting heart rate", shortLabel: "RHR", unit: "bpm", color: "#fb7185", higherIsBetter: false, decimals: 0 },
  sleepHours: { key: "sleepHours", label: "Sleep duration", shortLabel: "Sleep", unit: "h", color: "#a78bfa", higherIsBetter: true, decimals: 1 },
  sleepEfficiency: { key: "sleepEfficiency", label: "Sleep efficiency", shortLabel: "Efficiency", unit: "%", color: "#7cc4ff", higherIsBetter: true, decimals: 0 },
  sleepConsistency: { key: "sleepConsistency", label: "Sleep consistency", shortLabel: "Consistency", unit: "%", color: "#f472b6", higherIsBetter: true, decimals: 0 },
  sleepDebtHours: { key: "sleepDebtHours", label: "Sleep debt", shortLabel: "Sleep debt", unit: "h", color: "#fbbf24", higherIsBetter: false, decimals: 1 },
  deepHours: { key: "deepHours", label: "Deep sleep", shortLabel: "Deep", unit: "h", color: "#3b82f6", higherIsBetter: true, decimals: 1 },
  remHours: { key: "remHours", label: "REM sleep", shortLabel: "REM", unit: "h", color: "#a78bfa", higherIsBetter: true, decimals: 1 },
  strain: { key: "strain", label: "Day strain", shortLabel: "Strain", unit: "", color: "#fb8a67", higherIsBetter: null, decimals: 1 },
  steps: { key: "steps", label: "Steps", shortLabel: "Steps", unit: "", color: "#34d399", higherIsBetter: true, decimals: 0 },
  calories: { key: "calories", label: "Calories burned", shortLabel: "Cal burn", unit: "kcal", color: "#fbbf24", higherIsBetter: null, decimals: 0 },
  maxHr: { key: "maxHr", label: "Max heart rate", shortLabel: "Max HR", unit: "bpm", color: "#fb7185", higherIsBetter: null, decimals: 0 },
  bedtimeHour: { key: "bedtimeHour", label: "Bedtime", shortLabel: "Bedtime", unit: "", color: "#a78bfa", higherIsBetter: false, decimals: 1 },
  alcoholDrinks: { key: "alcoholDrinks", label: "Alcohol", shortLabel: "Alcohol", unit: "drinks", color: "#fb7185", higherIsBetter: false, decimals: 1 },
  caffeineMg: { key: "caffeineMg", label: "Caffeine", shortLabel: "Caffeine", unit: "mg", color: "#fbbf24", higherIsBetter: null, decimals: 0 },
  stress: { key: "stress", label: "Stress", shortLabel: "Stress", unit: "/10", color: "#fb8a67", higherIsBetter: false, decimals: 1 },
  mood: { key: "mood", label: "Mood", shortLabel: "Mood", unit: "/10", color: "#34d399", higherIsBetter: true, decimals: 1 },
  proteinG: { key: "proteinG", label: "Protein intake", shortLabel: "Protein", unit: "g", color: "#4d9fff", higherIsBetter: true, decimals: 0 },
  carbsG: { key: "carbsG", label: "Carb intake", shortLabel: "Carbs", unit: "g", color: "#fbbf24", higherIsBetter: null, decimals: 0 },
  fatG: { key: "fatG", label: "Fat intake", shortLabel: "Fat", unit: "g", color: "#fb8a67", higherIsBetter: null, decimals: 0 },
  calorieIntake: { key: "calorieIntake", label: "Calorie intake", shortLabel: "Intake", unit: "kcal", color: "#fbbf24", higherIsBetter: null, decimals: 0 },
  screenTimeMin: { key: "screenTimeMin", label: "Screen time", shortLabel: "Screen", unit: "min", color: "#8b91c7", higherIsBetter: false, decimals: 0 },
  meetingCount: { key: "meetingCount", label: "Meetings per day", shortLabel: "Meetings", unit: "", color: "#fbbf24", higherIsBetter: null, decimals: 0 },
  meetingMinutes: { key: "meetingMinutes", label: "Time in meetings", shortLabel: "Meeting time", unit: "min", color: "#fb8a67", higherIsBetter: null, decimals: 0 },
  firstMeetingHour: { key: "firstMeetingHour", label: "First meeting start", shortLabel: "First meeting", unit: "", color: "#a78bfa", higherIsBetter: null, decimals: 1 },
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
  | "worklife"
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

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export const MEALS: { id: MealType; label: string; emoji: string }[] = [
  { id: "breakfast", label: "Breakfast", emoji: "🌅" },
  { id: "lunch", label: "Lunch", emoji: "🥗" },
  { id: "dinner", label: "Dinner", emoji: "🍽️" },
  { id: "snack", label: "Snacks", emoji: "🍎" },
];

/** A logged food. cal/protein/carbs/fat are PER SERVING; scale by `servings`. */
export interface FoodEntry {
  id: string;
  date: string; // YYYY-MM-DD
  meal: MealType;
  name: string;
  servingLabel: string; // e.g. "1 cup", "100 g", "1 scoop"
  servings: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface NutritionGoals {
  calories: number;
  protein: number; // grams
  carbs: number; // grams
  fat: number; // grams
}

export interface HealthGoals {
  recovery: number; // target %
  sleepHours: number; // target hours/night
  steps: number; // target steps/day
}

export interface FoodItem {
  name: string;
  category: string;
  servingLabel: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}
