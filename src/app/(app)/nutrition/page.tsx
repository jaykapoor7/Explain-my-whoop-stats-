"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { Button, Card, FadeIn } from "@/components/ui";
import { useApp } from "@/lib/store";
import { FOODS, searchFoods } from "@/lib/nutrition/foods";
import {
  GOAL_PRESETS,
  defaultMealForNow,
  entryTotals,
  macrosFromCalories,
  sumEntries,
  todayKey,
} from "@/lib/nutrition/nutrition";
import { FoodEntry, FoodItem, MealType, MEALS, NutritionGoals } from "@/lib/types";
import { cn, uid } from "@/lib/utils";

function addDays(key: string, n: number): string {
  const d = new Date(key + "T12:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function niceDate(key: string): string {
  const t = todayKey();
  if (key === t) return "Today";
  if (key === addDays(t, -1)) return "Yesterday";
  return new Date(key + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

const MACROS = [
  { key: "protein" as const, label: "Protein", color: "#4d9fff", gkey: "protein" as const },
  { key: "carbs" as const, label: "Carbs", color: "#fbbf24", gkey: "carbs" as const },
  { key: "fat" as const, label: "Fat", color: "#fb8a67", gkey: "fat" as const },
];

function CalorieRing({ consumed, goal }: { consumed: number; goal: number }) {
  const size = 168;
  const stroke = 13;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = goal > 0 ? Math.min(1, consumed / goal) : 0;
  const remaining = Math.round(goal - consumed);
  const over = remaining < 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="cal-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={over ? "#fb7185" : "#7c6bff"} />
            <stop offset="55%" stopColor={over ? "#fb8a67" : "#2dd4ee"} />
            <stop offset="100%" stopColor={over ? "#fbbf24" : "#34d399"} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#cal-ring)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - frac) }}
          transition={{ duration: 0.8, ease: [0.22, 0.61, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-4xl font-bold tabular tracking-tight", over && "text-[#ffa2b0]")}>
          {Math.abs(remaining).toLocaleString()}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-widest text-base-400">
          {over ? "over" : "kcal left"}
        </span>
      </div>
    </div>
  );
}

function MacroBar({ label, color, value, goal }: { label: string; color: string; value: number; goal: number }) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-base-200">{label}</span>
        <span className="tabular text-base-400">
          <span className="text-base-100">{Math.round(value)}</span> / {goal} g
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.07]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function GoalsEditor({
  goals,
  onSave,
  onClose,
}: {
  goals: NutritionGoals;
  onSave: (g: NutritionGoals) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(goals);
  const set = (k: keyof NutritionGoals, v: number) => setDraft((d) => ({ ...d, [k]: Math.max(0, v) }));
  const macroCals = draft.protein * 4 + draft.carbs * 4 + draft.fat * 9;

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
      <Card className="gradient-ring mb-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Daily goals</h3>
          <button onClick={onClose} className="text-base-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {GOAL_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setDraft(p.goals)}
              className="rounded-full border border-white/12 px-3 py-1.5 text-xs font-medium text-base-200 transition hover:bg-white/[0.08]"
            >
              {p.label} · {p.goals.calories} kcal
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([
            ["calories", "Calories", "kcal"],
            ["protein", "Protein", "g"],
            ["carbs", "Carbs", "g"],
            ["fat", "Fat", "g"],
          ] as const).map(([k, label, unit]) => (
            <div key={k}>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-base-400">{label}</label>
              <div className="flex items-center rounded-lg border border-white/12 bg-base-900 px-2.5">
                <input
                  type="number"
                  value={draft[k]}
                  onChange={(e) => set(k, parseInt(e.target.value || "0", 10))}
                  className="h-10 w-full bg-transparent text-sm tabular outline-none"
                />
                <span className="text-xs text-base-400">{unit}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={() => setDraft(macrosFromCalories(draft.calories))}
            className="text-xs text-accent-soft hover:underline"
          >
            Auto-split macros from calories (30 / 40 / 30)
          </button>
          <span className={cn("text-xs", Math.abs(macroCals - draft.calories) > 60 ? "text-[#fcd34d]" : "text-base-400")}>
            macros ≈ {Math.round(macroCals)} kcal
          </span>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            Save goals
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

function AddCustom({ meal, date, onAdd, onClose }: { meal: MealType; date: string; onAdd: (e: FoodEntry) => void; onClose: () => void }) {
  const [f, setF] = useState({ name: "", calories: "", proteinG: "", carbsG: "", fatG: "" });
  const valid = f.name.trim() && f.calories;
  return (
    <div className="mt-2 rounded-xl border border-white/12 bg-base-900/60 p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <input
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
          placeholder="Food name"
          className="col-span-2 h-9 rounded-lg border border-white/12 bg-base-900 px-2.5 text-sm outline-none focus:border-accent/60 sm:col-span-1"
        />
        {(["calories", "proteinG", "carbsG", "fatG"] as const).map((k) => (
          <input
            key={k}
            type="number"
            value={f[k]}
            onChange={(e) => setF({ ...f, [k]: e.target.value })}
            placeholder={k === "calories" ? "kcal" : k === "proteinG" ? "P (g)" : k === "carbsG" ? "C (g)" : "F (g)"}
            className="h-9 rounded-lg border border-white/12 bg-base-900 px-2.5 text-sm tabular outline-none focus:border-accent/60"
          />
        ))}
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!valid}
          onClick={() => {
            onAdd({
              id: uid(),
              date,
              meal,
              name: f.name.trim(),
              servingLabel: "1 serving",
              servings: 1,
              calories: parseInt(f.calories || "0", 10),
              proteinG: parseInt(f.proteinG || "0", 10),
              carbsG: parseInt(f.carbsG || "0", 10),
              fatG: parseInt(f.fatG || "0", 10),
            });
            onClose();
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

export default function NutritionPage() {
  const foodLog = useApp((s) => s.foodLog);
  const goals = useApp((s) => s.nutritionGoals);
  const addFood = useApp((s) => s.addFood);
  const removeFood = useApp((s) => s.removeFood);
  const updateFoodServings = useApp((s) => s.updateFoodServings);
  const setGoals = useApp((s) => s.setNutritionGoals);
  const hydrated = useApp((s) => s.hydrated);

  const [date, setDate] = useState(todayKey());
  const [meal, setMeal] = useState<MealType>(defaultMealForNow());
  const [query, setQuery] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [editingGoals, setEditingGoals] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const dayEntries = useMemo(() => foodLog.filter((e) => e.date === date), [foodLog, date]);
  const totals = useMemo(() => sumEntries(dayEntries), [dayEntries]);
  const results = useMemo(() => (query ? searchFoods(query, 8) : []), [query]);

  const quickAdd = (item: FoodItem) => {
    addFood({
      id: uid(),
      date,
      meal,
      name: item.name,
      servingLabel: item.servingLabel,
      servings: 1,
      calories: item.calories,
      proteinG: item.proteinG,
      carbsG: item.carbsG,
      fatG: item.fatG,
    });
    setQuery("");
    searchRef.current?.focus();
  };

  if (!hydrated) return <div className="flex min-h-[40vh] items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/80" /></div>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nutrition</h1>
          <p className="mt-1 text-sm text-base-400">Log food, hit your macros, keep it simple.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-white/12 p-1">
            <button onClick={() => setDate(addDays(date, -1))} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/[0.08]">
              <ChevronLeft size={15} />
            </button>
            <span className="min-w-[74px] text-center text-sm font-medium">{niceDate(date)}</span>
            <button
              onClick={() => setDate(addDays(date, 1))}
              disabled={date >= todayKey()}
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/[0.08] disabled:opacity-30"
            >
              <ChevronRight size={15} />
            </button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEditingGoals((v) => !v)}>
            <Settings2 size={14} /> Goals
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <AnimatePresence>
          {editingGoals && <GoalsEditor goals={goals} onSave={setGoals} onClose={() => setEditingGoals(false)} />}
        </AnimatePresence>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Summary */}
        <FadeIn>
          <Card className="flex flex-col items-center gap-5 p-6 lg:sticky lg:top-6">
            <CalorieRing consumed={totals.calories} goal={goals.calories} />
            <div className="flex w-full justify-between text-center text-xs">
              <div>
                <div className="text-base font-semibold tabular">{Math.round(totals.calories)}</div>
                <div className="text-base-400">eaten</div>
              </div>
              <div>
                <div className="text-base font-semibold tabular">{goals.calories}</div>
                <div className="text-base-400">goal</div>
              </div>
              <div>
                <div className="text-base font-semibold tabular">{dayEntries.length}</div>
                <div className="text-base-400">items</div>
              </div>
            </div>
            <div className="w-full space-y-3 border-t border-white/[0.07] pt-4">
              {MACROS.map((m) => (
                <MacroBar key={m.key} label={m.label} color={m.color} value={totals[m.key]} goal={goals[m.gkey]} />
              ))}
            </div>
          </Card>
        </FadeIn>

        {/* Log */}
        <div>
          {/* Quick add */}
          <FadeIn>
            <Card className="p-4">
              <div className="flex flex-wrap items-center gap-1.5">
                {MEALS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMeal(m.id)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-medium transition",
                      meal === m.id ? "bg-white text-base-950" : "border border-white/12 text-base-300 hover:bg-white/[0.08]"
                    )}
                  >
                    {m.emoji} {m.label}
                  </button>
                ))}
              </div>
              <div className="relative mt-3">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base-400" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search food to add to ${MEALS.find((m) => m.id === meal)?.label.toLowerCase()}…`}
                  className="h-11 w-full rounded-xl border border-white/12 bg-base-900 pl-9 pr-3 text-sm outline-none focus:border-accent/60"
                />
                <AnimatePresence>
                  {query && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="glass absolute z-20 mt-1.5 max-h-72 w-full overflow-y-auto rounded-xl p-1.5 shadow-xl"
                    >
                      {results.length ? (
                        results.map((f) => (
                          <button
                            key={f.name}
                            onClick={() => quickAdd(f)}
                            className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition hover:bg-white/[0.07]"
                          >
                            <span>
                              <span className="text-sm text-base-100">{f.name}</span>
                              <span className="ml-2 text-xs text-base-400">{f.servingLabel}</span>
                            </span>
                            <span className="shrink-0 text-xs tabular text-base-400">
                              {f.calories} kcal · {f.proteinG}P {f.carbsG}C {f.fatG}F
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-3 text-sm text-base-400">
                          No match.{" "}
                          <button onClick={() => { setShowCustom(true); setQuery(""); }} className="text-accent-soft hover:underline">
                            Add “{query}” as custom
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button
                onClick={() => setShowCustom((v) => !v)}
                className="mt-2 text-xs font-medium text-accent-soft hover:underline"
              >
                + Add a custom food
              </button>
              {showCustom && <AddCustom meal={meal} date={date} onAdd={addFood} onClose={() => setShowCustom(false)} />}
            </Card>
          </FadeIn>

          {/* Meals */}
          <div className="mt-4 space-y-3">
            {MEALS.map((m) => {
              const items = dayEntries.filter((e) => e.meal === m.id);
              const mt = sumEntries(items);
              return (
                <FadeIn key={m.id}>
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">
                        {m.emoji} {m.label}
                      </h3>
                      <span className="text-xs tabular text-base-400">{Math.round(mt.calories)} kcal</span>
                    </div>
                    {items.length ? (
                      <div className="mt-2 divide-y divide-white/[0.05]">
                        {items.map((e) => {
                          const t = entryTotals(e);
                          return (
                            <div key={e.id} className="flex items-center gap-3 py-2">
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm text-base-100">{e.name}</div>
                                <div className="text-[11px] tabular text-base-400">
                                  {Math.round(t.calories)} kcal · {Math.round(t.protein)}P {Math.round(t.carbs)}C {Math.round(t.fat)}F
                                </div>
                              </div>
                              <div className="flex items-center gap-1 rounded-full border border-white/12 p-0.5">
                                <button onClick={() => updateFoodServings(e.id, e.servings - 0.5)} className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/[0.08]">
                                  <Minus size={12} />
                                </button>
                                <span className="w-10 text-center text-xs tabular">{e.servings}×</span>
                                <button onClick={() => updateFoodServings(e.id, e.servings + 0.5)} className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/[0.08]">
                                  <Plus size={12} />
                                </button>
                              </div>
                              <button onClick={() => removeFood(e.id)} className="text-base-400 transition hover:text-[#ffa2b0]" aria-label="Remove">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setMeal(m.id);
                          searchRef.current?.focus();
                        }}
                        className="mt-2 w-full rounded-lg border border-dashed border-white/12 py-2.5 text-xs text-base-400 transition hover:border-white/25 hover:text-base-200"
                      >
                        + Add to {m.label.toLowerCase()}
                      </button>
                    )}
                  </Card>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
