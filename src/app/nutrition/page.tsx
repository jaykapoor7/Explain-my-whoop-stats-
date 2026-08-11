"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Search, Trash2, UtensilsCrossed, X } from "lucide-react";
import { Card, EmptyState, PageHeader, ProgressBar, Section, SkeletonPage, Why } from "@/components/ui";
import { MiniBars } from "@/components/charts";
import { useHealth } from "@/lib/data/use-health";
import { useApp } from "@/lib/data/store";
import { FOOD_DB } from "@/lib/foods";
import { DOMAIN_COLOR, addDays, cn, fmtDate, fmtNum, todayISO } from "@/lib/format";
import { Meal, MealKind, NutritionFood } from "@/lib/types";

const MEAL_LABEL: Record<MealKind, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" };

function MacroRow({ label, value, goal, unit = "g", color }: { label: string; value: number; goal?: number; unit?: string; color: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-ink-200">{label}</span>
        <span className="tabular text-ink-400">
          <span className="text-ink-100">{fmtNum(value)}</span>
          {goal ? ` / ${fmtNum(goal)}` : ""} {unit}
        </span>
      </div>
      <div className="mt-1.5">
        <ProgressBar value={value} max={goal ?? value} color={color} />
      </div>
    </div>
  );
}

function AddFood({ date, onClose }: { date: string; onClose: () => void }) {
  const addMeal = useApp((s) => s.addMeal);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<MealKind>("snack");
  const [servings, setServings] = useState(1);
  const [selected, setSelected] = useState<NutritionFood | null>(null);
  const [custom, setCustom] = useState(false);
  const [cf, setCf] = useState({ name: "", kcal: "", protein: "", carbs: "", fat: "" });

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return FOOD_DB.slice(0, 6);
    return FOOD_DB.filter((f) => f.name.toLowerCase().includes(query)).slice(0, 8);
  }, [q]);

  const commit = (food: NutritionFood) => {
    const meal: Meal = { id: `u-${Date.now()}`, date, kind, items: [{ food, servings }] };
    addMeal(meal);
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink-100">Log food</span>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-100" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(Object.keys(MEAL_LABEL) as MealKind[]).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition", kind === k ? "bg-ink-50 text-ink-950" : "border border-white/12 text-ink-300 hover:bg-white/[0.06]")}
            >
              {MEAL_LABEL[k]}
            </button>
          ))}
        </div>

        {!custom ? (
          <>
            <div className="relative mt-3">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setSelected(null); }}
                placeholder="Search foods…"
                className="h-10 w-full rounded-xl border border-white/10 bg-ink-875 pl-9 pr-3 text-sm text-ink-100 outline-none focus:border-white/25"
              />
            </div>
            <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
              {results.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelected(f)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition",
                    selected?.id === f.id ? "bg-white/[0.09]" : "hover:bg-white/[0.05]"
                  )}
                >
                  <span className="text-sm text-ink-100">
                    {f.name} <span className="ml-1 text-xs text-ink-500">{f.serving}</span>
                  </span>
                  <span className="tabular shrink-0 text-xs text-ink-400">
                    {f.kcal} kcal · {f.protein}P {f.carbs}C {f.fat}F
                  </span>
                </button>
              ))}
              {!results.length && <p className="px-3 py-2 text-xs text-ink-400">No match — add it as a custom food.</p>}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.05] pt-3">
              <button onClick={() => setCustom(true)} className="text-xs font-medium text-nutrition hover:underline">
                + Custom food
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-400">Servings</span>
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={servings}
                  onChange={(e) => setServings(Math.max(0.5, parseFloat(e.target.value) || 1))}
                  className="tabular h-8 w-16 rounded-lg border border-white/12 bg-ink-875 px-2 text-right text-xs text-ink-100 outline-none"
                />
                <button
                  disabled={!selected}
                  onClick={() => selected && commit(selected)}
                  className="rounded-full bg-nutrition px-4 py-1.5 text-xs font-semibold text-ink-950 disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <input value={cf.name} onChange={(e) => setCf({ ...cf, name: e.target.value })} placeholder="Name" className="col-span-2 h-9 rounded-lg border border-white/12 bg-ink-875 px-2.5 text-sm text-ink-100 outline-none sm:col-span-1" />
              {(["kcal", "protein", "carbs", "fat"] as const).map((k) => (
                <input key={k} type="number" value={cf[k]} onChange={(e) => setCf({ ...cf, [k]: e.target.value })} placeholder={k === "kcal" ? "kcal" : `${k} g`} className="tabular h-9 rounded-lg border border-white/12 bg-ink-875 px-2.5 text-sm text-ink-100 outline-none" />
              ))}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setCustom(false)} className="rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-medium text-ink-200">Back</button>
              <button
                disabled={!cf.name.trim() || !cf.kcal}
                onClick={() =>
                  commit({
                    id: `cf-${Date.now()}`,
                    name: cf.name.trim(),
                    serving: "1 serving",
                    kcal: +cf.kcal || 0,
                    protein: +cf.protein || 0,
                    carbs: +cf.carbs || 0,
                    fat: +cf.fat || 0,
                  })
                }
                className="rounded-full bg-nutrition px-4 py-1.5 text-xs font-semibold text-ink-950 disabled:opacity-40"
              >
                Add custom
              </button>
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
}

export default function NutritionPage() {
  const data = useHealth();
  const removeMeal = useApp((s) => s.removeMeal);
  const allMeals = useApp((s) => s.meals);
  const [adding, setAdding] = useState(false);
  const [range, setRange] = useState<"day" | "week" | "month">("day");

  if (!data.hydrated) return <SkeletonPage />;

  const t = data.today;
  const tot = data.todayTotals;
  const kcalGoal = data.goals.find((g) => g.kind === "calories")?.target ?? 2400;
  const proteinGoal = data.goals.find((g) => g.kind === "protein")?.target ?? 150;
  const carbsGoal = 280;
  const fatGoal = 80;
  const burn = t ? t.day.activeCalories + t.day.restingCalories : 0;
  const remaining = kcalGoal - tot.kcal;
  

  const rangeDays = range === "day" ? 7 : range === "week" ? 7 : 30;
  const byDate = new Map<string, number>();
  for (const m of allMeals) {
    const kc = m.items.reduce((a, i) => a + i.food.kcal * i.servings, 0);
    byDate.set(m.date, (byDate.get(m.date) ?? 0) + kc);
  }
  const rangeData = Array.from({ length: rangeDays }, (_, i) => addDays(todayISO(), -(rangeDays - 1 - i))).map((d) => ({
    label: fmtDate(d),
    value: Math.round(byDate.get(d) ?? 0),
  }));
  const adherent = rangeData.filter((r) => r.value > 0 && r.value <= kcalGoal * 1.05).length;

  return (
    <div className="animate-fadeUp">
      <PageHeader
        title="Nutrition"
        sub="Calories and macros against your goals."
        right={
          <button onClick={() => setAdding(!adding)} className="flex items-center gap-1.5 rounded-full bg-nutrition px-4 py-2 text-xs font-semibold text-ink-950">
            <Plus size={14} /> Log food
          </button>
        }
      />

      <div className="mt-5">
        <AnimatePresence>{adding && <AddFood date={todayISO()} onClose={() => setAdding(false)} />}</AnimatePresence>
      </div>

      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <span className="tabular text-3xl font-bold text-ink-50">{fmtNum(Math.abs(remaining))}</span>
            <span className="ml-1.5 text-sm text-ink-400">kcal {remaining >= 0 ? "remaining" : "over"}</span>
          </div>
          <span className="tabular text-xs text-ink-400">
            {fmtNum(tot.kcal)} eaten · {fmtNum(burn)} burned
          </span>
        </div>
        <div className="mt-3">
          <ProgressBar value={tot.kcal} max={kcalGoal} color={DOMAIN_COLOR.nutrition} invertOver />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <MacroRow label="Protein" value={tot.protein} goal={proteinGoal} color="#5cc8ff" />
          <MacroRow label="Carbs" value={tot.carbs} goal={carbsGoal} color="#f6b83b" />
          <MacroRow label="Fat" value={tot.fat} goal={fatGoal} color="#ff9f7a" />
          <MacroRow label="Fiber" value={tot.fiber} goal={30} color="#8ee06a" />
        </div>
        <div className="mt-3 text-[11px] text-ink-500">
          Sugar {tot.sugar}g · Sodium {fmtNum(tot.sodium)}mg
        </div>
        <Why summary="Intake vs expenditure today">
          You&apos;ve eaten {fmtNum(tot.kcal)} kcal against roughly {burn ? `${fmtNum(burn)} kcal burned` : "connect Fitbit for burn"} (resting + activity),
          a net of {fmtNum(tot.kcal - burn)} kcal. Your calorie goal is {fmtNum(kcalGoal)} and your protein
          target is {proteinGoal}g — designed around your current weight goal.
        </Why>
      </Card>

      <Section title="Today's meals">
        {data.todayMeals.length ? (
          <div className="space-y-3">
            {(Object.keys(MEAL_LABEL) as MealKind[]).map((kind) => {
              const kindMeals = data.todayMeals.filter((m) => m.kind === kind);
              if (!kindMeals.length) return null;
              const kcal = kindMeals.reduce((s, m) => s + m.items.reduce((a, i) => a + i.food.kcal * i.servings, 0), 0);
              return (
                <Card key={kind} className="p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] font-semibold text-ink-100">{MEAL_LABEL[kind]}</span>
                    <span className="tabular text-xs text-ink-400">{fmtNum(kcal)} kcal</span>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {kindMeals.flatMap((m) =>
                      m.items.map((it, idx) => (
                        <div key={`${m.id}-${idx}`} className="flex items-center gap-2 text-sm">
                          <span className="text-ink-100">{it.food.name}</span>
                          <span className="text-xs text-ink-500">
                            {it.servings !== 1 ? `${it.servings}× ` : ""}
                            {it.food.serving}
                          </span>
                          <span className="tabular ml-auto text-xs text-ink-400">
                            {Math.round(it.food.kcal * it.servings)} kcal · {Math.round(it.food.protein * it.servings)}P
                          </span>
                          {(
                            <button onClick={() => removeMeal(m.id)} className="text-ink-500 hover:text-bad" aria-label="Remove">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={<UtensilsCrossed size={20} />} title="Nothing logged yet" body="Log your first meal to start tracking calories and macros." />
        )}
      </Section>

      <Section
        title="Progress"
        sub={`${adherent} logged day${adherent === 1 ? "" : "s"} within your calorie cap in the last ${rangeDays}`}
        action={
          <div className="flex overflow-hidden rounded-lg border border-white/[0.08] text-xs">
            {(["day", "week", "month"] as const).map((r) => (
              <button key={r} onClick={() => setRange(r)} className={cn("px-3 py-1.5 font-medium capitalize", range === r ? "bg-white/[0.1] text-ink-50" : "text-ink-400")}>
                {r}
              </button>
            ))}
          </div>
        }
      >
        <Card>
          <MiniBars data={rangeData} color={DOMAIN_COLOR.nutrition} unit=" kcal" name="Intake" />
        </Card>
      </Section>

      <p className="mt-8 text-center text-[11px] text-ink-500">
        Food database is built-in for now — the architecture supports a search API and barcode scanning later.
      </p>
    </div>
  );
}
