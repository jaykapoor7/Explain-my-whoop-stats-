import { DayRecord, FoodEntry, NutritionGoals } from "../types";

/** Nutrition math + folding logged food into the day records used by analysis. */

export const DEFAULT_GOALS: NutritionGoals = { calories: 2200, protein: 160, carbs: 220, fat: 73 };

export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function entryTotals(e: FoodEntry): MacroTotals {
  return {
    calories: e.calories * e.servings,
    protein: e.proteinG * e.servings,
    carbs: e.carbsG * e.servings,
    fat: e.fatG * e.servings,
  };
}

export function sumEntries(entries: FoodEntry[]): MacroTotals {
  return entries.reduce<MacroTotals>(
    (acc, e) => {
      const t = entryTotals(e);
      acc.calories += t.calories;
      acc.protein += t.protein;
      acc.carbs += t.carbs;
      acc.fat += t.fat;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export function roundTotals(t: MacroTotals): MacroTotals {
  return {
    calories: Math.round(t.calories),
    protein: Math.round(t.protein),
    carbs: Math.round(t.carbs),
    fat: Math.round(t.fat),
  };
}

/** Split a calorie target into macro grams (protein/carbs 4 kcal/g, fat 9 kcal/g). */
export function macrosFromCalories(
  calories: number,
  split: { protein: number; carbs: number; fat: number } = { protein: 0.3, carbs: 0.4, fat: 0.3 }
): NutritionGoals {
  return {
    calories,
    protein: Math.round((calories * split.protein) / 4),
    carbs: Math.round((calories * split.carbs) / 4),
    fat: Math.round((calories * split.fat) / 9),
  };
}

export const GOAL_PRESETS: { id: string; label: string; goals: NutritionGoals }[] = [
  { id: "cut", label: "Cut", goals: macrosFromCalories(1900, { protein: 0.4, carbs: 0.3, fat: 0.3 }) },
  { id: "maintain", label: "Maintain", goals: macrosFromCalories(2200, { protein: 0.3, carbs: 0.4, fat: 0.3 }) },
  { id: "bulk", label: "Bulk", goals: macrosFromCalories(2800, { protein: 0.3, carbs: 0.45, fat: 0.25 }) },
  { id: "highprotein", label: "High protein", goals: macrosFromCalories(2200, { protein: 0.4, carbs: 0.35, fat: 0.25 }) },
];

/** Fold logged food totals into day records (logged days override intake fields). */
export function enrichDaysWithNutrition(days: DayRecord[], foodLog: FoodEntry[]): DayRecord[] {
  if (!foodLog.length) return days;
  const byDate = new Map<string, FoodEntry[]>();
  for (const e of foodLog) {
    const arr = byDate.get(e.date) ?? [];
    arr.push(e);
    byDate.set(e.date, arr);
  }

  const map = new Map<string, DayRecord>();
  for (const d of days) map.set(d.date, { ...d });
  for (const [date, entries] of byDate) {
    const t = roundTotals(sumEntries(entries));
    const d = map.get(date) ?? { date };
    d.calorieIntake = t.calories;
    d.proteinG = t.protein;
    d.carbsG = t.carbs;
    d.fatG = t.fat;
    map.set(date, d);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function defaultMealForNow(): FoodEntry["meal"] {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 16) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}
