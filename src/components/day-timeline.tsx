"use client";

import { Flame, Moon, Sparkles, Sun } from "lucide-react";
import { Card, IconBadge } from "@/components/ui";
import { ScoredDay } from "@/lib/scoring/engine";
import { energySplit } from "@/lib/scoring/energy";
import { countedActivities, estimateActivityLoad } from "@/lib/scoring/strain";
import { DOMAIN_COLOR, fmtNum, fmtTime } from "@/lib/format";

interface Row {
  time: string; // "HH:MM" for sorting
  label: string;
  detail?: string;
  badge?: string;
  color: string;
  icon: React.ReactNode;
}

const hm = (iso?: string) => (iso && iso.length >= 16 ? iso.slice(11, 16) : "");
const energyColor = (v: number) => (v >= 60 ? DOMAIN_COLOR.energy : v >= 40 ? "#e0932a" : "#ef5a45");

/**
 * A calm chronological read of the day: when you woke, the sessions that spent
 * energy, and where your battery sits now — connecting health events to the
 * metric that moved. Built only from real synced data; no fabricated points.
 */
export function DayTimeline({ day, isLatest, maxHr }: { day: ScoredDay; isLatest: boolean; maxHr: number }) {
  const rows: Row[] = [];
  const restHr = day.baseline.rhrBpm;

  // Wake → morning capacity you started with.
  const wake = hm(day.day.sleep.wake);
  const enOk = day.energy.available !== false;
  if (wake) {
    const cap = enOk ? energySplit(day.energy).morningCapacity : null;
    rows.push({
      time: wake,
      label: "Woke up",
      detail: cap != null ? "started the day" : "start of day",
      badge: cap != null ? `${Math.round(cap)}% capacity` : undefined,
      color: DOMAIN_COLOR.sleep,
      icon: <Sun size={14} />,
    });
  }

  // Each counted session, with its personalised load.
  for (const a of countedActivities(day.day)) {
    const load = a.avgHr > 0 ? estimateActivityLoad(a.durationMin, a.avgHr, restHr, maxHr) : a.load;
    rows.push({
      time: hm(a.start) || "12:00",
      label: a.type,
      detail: `${a.durationMin}m${a.avgHr > 0 ? ` · avg ${a.avgHr} bpm` : ""} · ${fmtNum(a.calories)} kcal`,
      badge: `+${load.toFixed(1)} load`,
      color: DOMAIN_COLOR.strain,
      icon: <Flame size={14} />,
    });
  }

  rows.sort((x, y) => x.time.localeCompare(y.time));

  // Where the battery sits right now (only the live day).
  if (isLatest && enOk) {
    rows.push({
      time: "99:98",
      label: "Now",
      detail: "energy remaining",
      badge: `${Math.round(day.energy.score)}%`,
      color: energyColor(day.energy.score),
      icon: <Sparkles size={14} />,
    });
  }
  // Tonight's target bedtime, as a soft closing marker.
  const bed = hm(day.day.sleep.bedtime);
  if (bed && day.day.sleep.inBedMin > 0) {
    rows.push({ time: "99:99", label: "Bedtime", detail: "last recorded", color: DOMAIN_COLOR.sleep, icon: <Moon size={14} /> });
  }

  if (rows.length < 2) return null;

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col">
        {rows.map((r, i) => {
          const last = i === rows.length - 1;
          const t = r.time.startsWith("99:") ? (r.label === "Now" ? "now" : r.label === "Bedtime" ? fmtTime(bed) : "") : fmtTime(r.time);
          return (
            <div key={i} className="flex gap-3">
              <div className="tabular w-14 shrink-0 pt-1 text-right text-[11px] font-semibold text-ink-400">{t}</div>
              <div className="relative flex flex-col items-center">
                <IconBadge color={r.color} size={28}>{r.icon}</IconBadge>
                {!last && <span className="my-1 w-px flex-1 bg-black/[0.09]" />}
              </div>
              <div className={last ? "min-w-0 flex-1 pb-0.5" : "min-w-0 flex-1 pb-5"}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink-100">{r.label}</span>
                  {r.badge && (
                    <span className="tabular rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: `${r.color}1c`, color: r.color }}>{r.badge}</span>
                  )}
                </div>
                {r.detail && <div className="mt-0.5 text-[11px] text-ink-400">{r.detail}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
