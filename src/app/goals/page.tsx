"use client";

import { useState } from "react";
import { Check, Dumbbell, Flame, Footprints, GraduationCap, Moon, Scale, Target, Beef } from "lucide-react";
import { Card, IconBadge, PageHeader, ProgressBar, SkeletonPage, Why } from "@/components/ui";
import { useHealth } from "@/lib/data/use-health";
import { useApp } from "@/lib/data/store";
import { cn, fmtDuration, fmtNum } from "@/lib/format";
import { Goal } from "@/lib/types";
import { ScoredDay } from "@/lib/scoring/engine";

const GOAL_COLOR: Record<string, string> = {
  weight: "#c9b98a", calories: "#5cc8ff", protein: "#38d39f", sleep: "#8b8cff",
  steps: "#8ee06a", training: "#ff7a5c", academic: "#9fb6ff",
};

const GOAL_ICON: Record<string, React.ReactNode> = {
  weight: <Scale size={16} />, calories: <Flame size={16} />, protein: <Beef size={16} />, sleep: <Moon size={16} />,
  steps: <Footprints size={16} />, training: <Dumbbell size={16} />, academic: <GraduationCap size={16} />,
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

/** The editable goals list — a real draft you Save, not live-writing inputs.
 * Only mounted after hydration so the draft initialises from loaded targets. */
function GoalsEditor({ rows }: { rows: { goal: Goal; value: number; caption: string; ok: boolean }[] }) {
  const setGoalTarget = useApp((s) => s.setGoalTarget);
  // Draft of targets in each goal's own unit (minutes for sleep), keyed by id.
  const [draft, setDraft] = useState<Record<string, number>>(() => Object.fromEntries(rows.map((r) => [r.goal.id, r.goal.target])));
  const [saved, setSaved] = useState(false);

  const dirty = rows.some((r) => draft[r.goal.id] !== r.goal.target);

  const save = () => {
    for (const r of rows) if (draft[r.goal.id] !== r.goal.target) setGoalTarget(r.goal.id, draft[r.goal.id]);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };
  const reset = () => setDraft(Object.fromEntries(rows.map((r) => [r.goal.id, r.goal.target])));

  return (
    <>
      <div className="mt-5 space-y-3">
        {rows.map(({ goal: g, value, caption, ok }) => {
          const color = GOAL_COLOR[g.kind] ?? "#8b93a1";
          const inHours = g.unit === "min"; // sleep stored in minutes, entered in hours
          const target = draft[g.id] ?? g.target;
          const changed = target !== g.target;
          return (
            <Card key={g.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <IconBadge color={color} size={30}>{GOAL_ICON[g.kind] ?? <Target size={16} />}</IconBadge>
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
                    step={inHours ? 0.5 : g.kind === "weight" ? 0.1 : 1}
                    value={inHours ? target / 60 : target}
                    onChange={(e) => {
                      const v = Math.max(0, parseFloat(e.target.value) || 0);
                      setDraft((d) => ({ ...d, [g.id]: inHours ? Math.round(v * 60) : v }));
                    }}
                    className={cn(
                      "tabular h-7 w-20 rounded-lg border bg-ink-875 px-2 text-right text-xs text-ink-100 outline-none transition",
                      changed ? "border-recovery/60" : "border-black/12",
                    )}
                  />
                  <span>{inHours ? "h" : g.unit}</span>
                </div>
              </div>
              <div className="mt-2.5">
                <ProgressBar
                  value={g.direction === "at-most" ? Math.min(value, target * 1.4) : value}
                  max={g.direction === "at-most" ? target * 1.4 : target}
                  color={color}
                  invertOver={g.direction === "at-most"}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-ink-400">
                <span>
                  <span className="tabular text-ink-200">{display(g, value)}</span> {caption}
                </span>
                <span>
                  {g.direction === "at-most" ? "cap" : g.direction === "at-least" ? "at least" : "target"}{" "}
                  <span className={cn(changed && "font-semibold text-recovery")}>{display(g, target)}</span>
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Inline save footer — consistent with Profile, Journal and manual entry */}
      <div className="mt-4 flex items-center justify-end gap-3">
        {dirty && (
          <button onClick={reset} className="rounded-full border border-black/15 px-4 py-2.5 text-xs font-medium text-ink-200 hover:bg-black/[0.05]">Discard</button>
        )}
        <span className="mr-auto text-[11px] text-ink-400">{dirty ? "Unsaved changes to your targets." : "Targets are saved and feeding every screen."}</span>
        <button
          onClick={save}
          disabled={!dirty}
          className={cn("flex items-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-semibold transition", dirty ? "bg-recovery text-[#241f18]" : "bg-black/[0.06] text-ink-400")}
        >
          {saved ? <><Check size={14} /> Saved</> : "Save targets"}
        </button>
      </div>
    </>
  );
}

export default function GoalsPage() {
  const data = useHealth();
  if (!data.hydrated) return <SkeletonPage />;

  const t = data.today;
  const week = data.days.slice(-7);
  const weeklyStudyH =
    Math.round(
      (week.reduce((sum, s) => sum + (s.day.journal?.tags.find((x) => x.label === "Studying")?.durationMin ?? 0), 0) / 60) * 10
    ) / 10;

  const rows = data.goals.map((g) => {
    const { value, caption } = currentValue(g, t, data.todayTotals, week, weeklyStudyH);
    return { goal: g, value, caption, ok: met(g, value) };
  });
  const hit = rows.filter((r) => r.ok).length;

  return (
    <div className="animate-fadeUp">
      <PageHeader title="Goals" sub={`${hit} of ${data.goals.length} on track — targets feed Today, Nutrition and the Planner.`} />

      <Card className="tint mt-5 flex items-center gap-4" style={{ ["--accent" as string]: "#13b57e" }}>
        <IconBadge color="#13b57e" size={44}><Target size={20} /></IconBadge>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="tabular font-display text-3xl font-bold text-recovery">{hit}</span>
            <span className="text-sm text-ink-400">of {data.goals.length} goals on track</span>
          </div>
          <div className="mt-2.5"><ProgressBar value={hit} max={data.goals.length} color="#13b57e" /></div>
        </div>
      </Card>

      <GoalsEditor rows={rows} />

      <div className="mt-6">
        <Why summary="How goals connect to the rest of the app">
          Calorie, protein and weight goals set the targets on the Nutrition page; the sleep and steps goals define
          &quot;on-track&quot; on Today; training and academic goals are read from your logged activities and journal.
          Save a target here and every screen updates.
        </Why>
      </div>
    </div>
  );
}
