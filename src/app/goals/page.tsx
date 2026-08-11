"use client";

import { Check } from "lucide-react";
import { Card, PageHeader, ProgressBar, SkeletonPage, Why } from "@/components/ui";
import { useHealth } from "@/lib/data/use-health";
import { useApp } from "@/lib/data/store";
import { fmtDuration, fmtNum } from "@/lib/format";
import { Goal } from "@/lib/types";
import { ScoredDay } from "@/lib/scoring/engine";

const GOAL_COLOR: Record<string, string> = {
  weight: "#c9b98a", calories: "#5cc8ff", protein: "#38d39f", sleep: "#8b8cff",
  steps: "#8ee06a", training: "#ff7a5c", academic: "#9fb6ff",
};

function currentValue(goal: Goal, t: ScoredDay | undefined, tot: { kcal: number; protein: number }, week: ScoredDay[], weeklyStudyH: number): { value: number; caption: string } {
  switch (goal.kind) {
    case "weight":
      return { value: t?.day.weightKg ?? 0, caption: t?.day.weightKg ? "current weight" : "no data yet" };
    case "calories":
      return { value: tot.kcal, caption: "eaten today" };
    case "protein":
      return { value: tot.protein, caption: "today" };
    case "sleep":
      return { value: t?.day.sleep.asleepMin ?? 0, caption: t ? "last night" : "no data yet" };
    case "steps":
      return { value: t?.day.steps ?? 0, caption: t ? "today" : "no data yet" };
    case "training": {
      const sessions = week.filter((s) => s.day.activities.some((a) => a.confidence !== "low" && a.type !== "Walking")).length;
      return { value: sessions, caption: "sessions this week" };
    }
    case "academic":
      return { value: weeklyStudyH, caption: "study hours this week" };
  }
}

function met(goal: Goal, value: number): boolean {
  if (goal.direction === "at-least") return value >= goal.target;
  if (goal.direction === "at-most") return value <= goal.target;
  return Math.abs(value - goal.target) <= goal.target * 0.01;
}

function display(goal: Goal, v: number): string {
  return goal.unit === "min" ? fmtDuration(v) : `${fmtNum(v, goal.kind === "weight" ? 1 : 0)} ${goal.unit}`;
}

export default function GoalsPage() {
  const data = useHealth();
  const setGoalTarget = useApp((s) => s.setGoalTarget);
  if (!data.hydrated) return <SkeletonPage />;

  const t = data.today;
  const week = data.days.slice(-7);
  const weeklyStudyH =
    Math.round(
      (week.reduce((sum, s) => sum + (s.day.journal?.tags.find((x) => x.label === "Studying")?.durationMin ?? 0), 0) / 60) * 10
    ) / 10;

  const hit = data.goals.filter((g) => met(g, currentValue(g, t, data.todayTotals, week, weeklyStudyH).value)).length;

  return (
    <div className="animate-fadeUp">
      <PageHeader title="Goals" sub={`${hit} of ${data.goals.length} on track — targets feed Today, Nutrition and the Planner.`} />

      <div className="mt-5 space-y-3">
        {data.goals.map((g) => {
          const { value, caption } = currentValue(g, t, data.todayTotals, week, weeklyStudyH);
          const ok = met(g, value);
          const color = GOAL_COLOR[g.kind] ?? "#8b93a1";
          return (
            <Card key={g.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-ink-100">{g.label}</span>
                {ok && (
                  <span className="flex items-center gap-1 rounded-full bg-good/15 px-2 py-0.5 text-[10px] font-semibold text-good">
                    <Check size={10} strokeWidth={3} /> on track
                  </span>
                )}
                <div className="ml-auto flex items-center gap-1.5 text-xs text-ink-400">
                  <span>target</span>
                  <input
                    type="number"
                    value={g.target}
                    onChange={(e) => setGoalTarget(g.id, Math.max(0, parseFloat(e.target.value) || 0))}
                    className="tabular h-7 w-20 rounded-lg border border-white/12 bg-ink-875 px-2 text-right text-xs text-ink-100 outline-none"
                  />
                  <span>{g.unit}</span>
                </div>
              </div>
              <div className="mt-2.5">
                <ProgressBar
                  value={g.direction === "at-most" ? Math.min(value, g.target * 1.4) : value}
                  max={g.direction === "at-most" ? g.target * 1.4 : g.target}
                  color={color}
                  invertOver={g.direction === "at-most"}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-ink-400">
                <span>
                  <span className="tabular text-ink-200">{display(g, value)}</span> {caption}
                </span>
                <span>
                  {g.direction === "at-most" ? "cap" : g.direction === "at-least" ? "at least" : "target"} {display(g, g.target)}
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-6">
        <Why summary="How goals connect to the rest of the app">
          Calorie, protein and weight goals set the targets on the Nutrition page; the sleep and steps goals define
          &quot;on-track&quot; on Today; training and academic goals are read from your logged activities and journal.
          Change a target here and every screen updates.
        </Why>
      </div>
    </div>
  );
}
