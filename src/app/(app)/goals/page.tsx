"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Activity, Check, Footprints, Moon, UtensilsCrossed } from "lucide-react";
import { useApp } from "@/lib/store";
import { useHealthData } from "@/lib/use-data";
import { Card, FadeIn, SectionHeading } from "@/components/ui";
import { GOAL_PRESETS, macrosFromCalories, sumEntries, todayKey } from "@/lib/nutrition/nutrition";
import { DayRecord, HealthGoals, MetricKey, NutritionGoals } from "@/lib/types";
import { fmt, mean } from "@/lib/stats";
import { cn } from "@/lib/utils";

const series = (days: DayRecord[], k: MetricKey) =>
  days.map((d) => d[k] as number | undefined).filter((v): v is number => v !== undefined);

function GoalRow({
  label,
  unit,
  current,
  target,
  color,
  higherIsBetter = true,
  decimals = 0,
  onTarget,
}: {
  label: string;
  unit: string;
  current: number;
  target: number;
  color: string;
  higherIsBetter?: boolean;
  decimals?: number;
  onTarget: (v: number) => void;
}) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const met = higherIsBetter ? current >= target * 0.95 : current <= target * 1.05;
  return (
    <div className="py-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-base-100">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs tabular text-base-400">
            <span className="text-base-100">{fmt(current, decimals)}</span> /
          </span>
          <div className="flex items-center rounded-lg border border-white/12 bg-base-900 px-2">
            <input
              type="number"
              value={target}
              onChange={(e) => onTarget(Math.max(0, parseFloat(e.target.value) || 0))}
              className="h-7 w-16 bg-transparent text-right text-xs tabular outline-none"
            />
            <span className="text-[11px] text-base-400">{unit}</span>
          </div>
          {met && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-status-good/20 text-[#6ee7b7]">
              <Check size={12} />
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]">
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

export default function GoalsPage() {
  const { days } = useHealthData();
  const foodLog = useApp((s) => s.foodLog);
  const nutritionGoals = useApp((s) => s.nutritionGoals);
  const healthGoals = useApp((s) => s.healthGoals);
  const setNutrition = useApp((s) => s.setNutritionGoals);
  const setHealth = useApp((s) => s.setHealthGoals);
  const hydrated = useApp((s) => s.hydrated);

  const last7 = useMemo(() => days.slice(-7), [days]);
  const today = useMemo(() => sumEntries(foodLog.filter((e) => e.date === todayKey())), [foodLog]);

  const setN = (patch: Partial<NutritionGoals>) => setNutrition({ ...nutritionGoals, ...patch });
  const setH = (patch: Partial<HealthGoals>) => setHealth({ ...healthGoals, ...patch });

  if (!hydrated)
    return <div className="flex min-h-[40vh] items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/80" /></div>;

  const recAvg = mean(series(last7, "recovery"));
  const sleepAvg = mean(series(last7, "sleepHours"));
  const stepsAvg = mean(series(last7, "steps"));
  const hasBody = last7.some((d) => d.recovery !== undefined || d.sleepHours !== undefined);

  return (
    <div className="mx-auto max-w-2xl">
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
        <p className="mt-1 text-sm text-base-400">Set your targets. Everything else measures against them.</p>
      </FadeIn>

      {/* Nutrition goals */}
      <SectionHeading title="Nutrition" subtitle="Today's progress" />
      <FadeIn>
        <Card>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-base-400">
            <UtensilsCrossed size={13} /> Daily targets
          </div>
          <div className="divide-y divide-white/[0.05]">
            <GoalRow label="Calories" unit="kcal" current={today.calories} target={nutritionGoals.calories} color="#7c6bff" onTarget={(v) => setN({ calories: v })} />
            <GoalRow label="Protein" unit="g" current={today.protein} target={nutritionGoals.protein} color="#4d9fff" onTarget={(v) => setN({ protein: v })} />
            <GoalRow label="Carbs" unit="g" current={today.carbs} target={nutritionGoals.carbs} color="#fbbf24" higherIsBetter={false} onTarget={(v) => setN({ carbs: v })} />
            <GoalRow label="Fat" unit="g" current={today.fat} target={nutritionGoals.fat} color="#fb8a67" higherIsBetter={false} onTarget={(v) => setN({ fat: v })} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] pt-3">
            <span className="mr-1 text-xs text-base-400">Quick set:</span>
            {GOAL_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setNutrition(p.goals)}
                className="rounded-full border border-white/12 px-2.5 py-1 text-xs font-medium text-base-200 transition hover:bg-white/[0.08]"
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setNutrition(macrosFromCalories(nutritionGoals.calories))}
              className="rounded-full border border-white/12 px-2.5 py-1 text-xs font-medium text-accent-soft transition hover:bg-white/[0.08]"
            >
              Auto macros
            </button>
          </div>
        </Card>
      </FadeIn>

      {/* Body & activity goals */}
      <SectionHeading title="Body & activity" subtitle="Your 7-day average vs target" />
      <FadeIn>
        <Card>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-base-400">
            <Activity size={13} /> Weekly targets
          </div>
          {hasBody ? (
            <div className="divide-y divide-white/[0.05]">
              <GoalRow label="Recovery" unit="%" current={isFinite(recAvg) ? recAvg : 0} target={healthGoals.recovery} color="#34d399" onTarget={(v) => setH({ recovery: v })} />
              <GoalRow label="Sleep" unit="h" current={isFinite(sleepAvg) ? sleepAvg : 0} target={healthGoals.sleepHours} color="#a78bfa" decimals={1} onTarget={(v) => setH({ sleepHours: v })} />
              <GoalRow label="Steps" unit="" current={isFinite(stepsAvg) ? stepsAvg : 0} target={healthGoals.steps} color="#2dd4ee" onTarget={(v) => setH({ steps: v })} />
            </div>
          ) : (
            <p className="py-4 text-sm text-base-400">
              Connect a device to track recovery, sleep and steps against your targets.{" "}
              <Link href="/connections" className="text-accent-soft hover:underline">Connect a device →</Link>
            </p>
          )}
        </Card>
      </FadeIn>

      <p className="mt-6 text-center text-xs text-base-400">
        Your goals show up on <Link href="/dashboard" className="text-accent-soft hover:underline">Understand</Link> and{" "}
        <Link href="/nutrition" className="text-accent-soft hover:underline">Nutrition</Link>.
      </p>
    </div>
  );
}
