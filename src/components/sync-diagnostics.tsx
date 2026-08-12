"use client";

import { AlertTriangle, CheckCircle2, Info, MinusCircle } from "lucide-react";
import { Card } from "@/components/ui";
import { useApp } from "@/lib/data/store";
import { fmtDate, fmtDuration, fmtNum } from "@/lib/format";
import { DailySummary } from "@/lib/types";

/**
 * Sync diagnostics — the honesty panel. It reads back exactly what the last
 * Google Health sync mapped onto each day so the numbers can be checked
 * against the Fitbit app, and flags any raw metric that came back empty
 * across every day (the tell-tale sign that a field didn't map, rather than
 * that you have no such data).
 */

interface Metric {
  key: string;
  label: string;
  unit: string;
  /** true = pulled straight from Fitbit; false = derived/approximated by the app */
  raw: boolean;
  get: (d: DailySummary) => number | undefined;
  fmt?: (v: number) => string;
}

const METRICS: Metric[] = [
  { key: "hrv", label: "HRV", unit: "ms", raw: true, get: (d) => d.hrv?.rmssdMs },
  { key: "rhr", label: "Resting HR", unit: "bpm", raw: true, get: (d) => d.rhr?.bpm },
  { key: "steps", label: "Steps", unit: "", raw: true, get: (d) => d.steps, fmt: (v) => fmtNum(v) },
  { key: "sleep", label: "Sleep", unit: "", raw: true, get: (d) => d.sleep?.asleepMin, fmt: (v) => fmtDuration(v) },
  { key: "cal", label: "Calories burned", unit: "kcal", raw: true, get: (d) => (d.activeCalories || 0) + (d.restingCalories || 0), fmt: (v) => fmtNum(v) },
  { key: "weight", label: "Weight", unit: "kg", raw: true, get: (d) => d.weightKg },
  { key: "acts", label: "Workouts", unit: "", raw: true, get: (d) => d.activities.length },
];

const present = (v: number | undefined) => v !== undefined && v > 0;

function CoverageRow({ metric, days }: { metric: Metric; days: DailySummary[] }) {
  const count = days.filter((d) => present(metric.get(d))).length;
  const total = days.length;
  const none = count === 0;
  const partial = count > 0 && count < total;

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="shrink-0">
        {none ? (
          <AlertTriangle size={14} className="text-warn" />
        ) : partial ? (
          <MinusCircle size={14} className="text-ink-400" />
        ) : (
          <CheckCircle2 size={14} className="text-good" />
        )}
      </span>
      <span className="text-[13px] text-ink-100">{metric.label}</span>
      <span className="tabular ml-auto text-xs text-ink-400">
        {count} / {total} days
      </span>
      <span className="w-24 text-right text-[11px] text-ink-500">
        {none ? "no values ⚠" : partial ? "partial" : "full"}
      </span>
    </div>
  );
}

export function SyncDiagnostics() {
  const wearableDays = useApp((s) => s.wearableDays);
  const lastSync = useApp((s) => s.lastSync);

  if (!wearableDays.length) {
    return (
      <Card className="flex items-start gap-3 p-4">
        <Info size={16} className="mt-0.5 shrink-0 text-ink-400" />
        <p className="text-xs leading-relaxed text-ink-400">
          Nothing synced yet. Connect above and press <span className="font-medium text-ink-200">Sync now</span> — this
          panel will then show exactly which metrics came back from Fitbit and their values, so you can check them
          against the Fitbit app.
        </p>
      </Card>
    );
  }

  const recent = wearableDays.slice(-7).reverse();
  const emptyRaw = METRICS.filter((m) => m.raw && wearableDays.every((d) => !present(m.get(d))));

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-ink-100">Metric coverage</span>
          <span className="text-[11px] text-ink-500">
            {wearableDays.length} days synced{lastSync ? ` · last ${new Date(lastSync).toLocaleString()}` : ""}
          </span>
        </div>
        <div className="mt-2 divide-y divide-white/[0.05]">
          {METRICS.map((m) => (
            <CoverageRow key={m.key} metric={m} days={wearableDays} />
          ))}
        </div>
        {emptyRaw.length > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-warn/25 bg-warn/[0.06] p-3">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warn" />
            <p className="text-xs leading-relaxed text-ink-200">
              <span className="font-semibold">{emptyRaw.map((m) => m.label).join(", ")}</span> came back empty for every
              day. If your Fitbit actually records {emptyRaw.length > 1 ? "these" : "this"}, it&apos;s a field-mapping
              gap in the sync, not missing data — worth reporting so it can be fixed for your account&apos;s exact
              response shape.
            </p>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <span className="text-sm font-semibold text-ink-100">Last 7 synced days</span>
        <p className="mt-0.5 text-[11px] text-ink-500">Compare these against your Fitbit app to confirm the sync is reading correctly.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-xs">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-500">
                <th className="py-1.5 pr-3 font-medium">Date</th>
                {METRICS.map((m) => (
                  <th key={m.key} className="py-1.5 pr-3 font-medium">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular">
              {recent.map((d) => (
                <tr key={d.date} className="border-t border-white/[0.05]">
                  <td className="py-1.5 pr-3 text-ink-300">{fmtDate(d.date, { month: "short", day: "numeric" })}</td>
                  {METRICS.map((m) => {
                    const v = m.get(d);
                    return (
                      <td key={m.key} className="py-1.5 pr-3 text-ink-100">
                        {present(v) ? (m.fmt ? m.fmt(v!) : `${v}${m.unit ? ` ${m.unit}` : ""}`) : <span className="text-ink-500">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="flex items-start gap-3 p-4">
        <Info size={16} className="mt-0.5 shrink-0 text-ink-400" />
        <div className="text-xs leading-relaxed text-ink-400">
          <p className="font-medium text-ink-200">How to read your numbers</p>
          <ul className="mt-1.5 space-y-1">
            <li>
              <span className="text-ink-200">Raw from Fitbit</span> — HRV, resting HR, steps, sleep duration &amp;
              stages, total calories, weight and workouts. These should match the Fitbit app.
            </li>
            <li>
              <span className="text-ink-200">Derived approximations</span> — the resting/active calorie split, sleeping
              HR, overnight-HRV attribution, sleep need (8h), sleep debt and consistency are estimated by the app, not
              read from Fitbit. Treat them as rough.
            </li>
            <li>
              <span className="text-ink-200">Scores</span> — Energy, Recovery, Sleep and Strain are computed from your
              real data but with placeholder weightings; the final algorithms are deliberately not designed yet, so read
              the trend and the &ldquo;what affected you&rdquo; ledger, not the exact number.
            </li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
