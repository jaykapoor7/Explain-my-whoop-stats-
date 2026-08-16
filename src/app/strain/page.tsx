"use client";

import { useState } from "react";
import { ScorePage } from "@/components/score-page";
import { Card, ConfidenceBadge, EmptyState, IconBadge, Section, StatusPill } from "@/components/ui";
import { StrainCurve, ZoneBars } from "@/components/charts";
import { useApp } from "@/lib/data/store";
import { countedActivities, estimateActivityLoad, maxHrFromAge } from "@/lib/scoring/strain";
import { trainingLoad, TrainingLoad } from "@/lib/scoring/load";
import { strainTarget } from "@/lib/scoring/strain-target";
import { ageFromBirthYear } from "@/lib/scoring/health-age";
import { DOMAIN_COLOR, cn, fmtNum, fmtTime } from "@/lib/format";
import { Activity } from "@/lib/types";
import { Flame, TrendingUp } from "lucide-react";
import { SessionPlanner } from "@/components/session-planner";

const LOAD_COLOR: Record<TrainingLoad["status"], string> = {
  detraining: "#a4977f", balanced: "#13b57e", ramping: "#eb9d18", overreaching: "#ef5a45",
};

/** Acute (7-day) vs chronic (28-day) training load — the workload view of strain. */
function TrainingLoadSection({ tl }: { tl: TrainingLoad }) {
  const c = LOAD_COLOR[tl.status];
  const barMax = Math.max(tl.acute, tl.chronic, 6) * 1.15;
  const Bar = ({ label, value, fill }: { label: string; value: number; fill: string }) => (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-ink-200">{label}</span>
        <span className="tabular text-ink-400"><span className="font-semibold text-ink-100">{value.toFixed(1)}</span> / 21</span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-black/[0.06]">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / barMax) * 100)}%`, background: fill }} />
      </div>
    </div>
  );
  return (
    <Section title="Training load" sub="Acute (7-day) vs chronic (28-day) — are you ramping up or backing off?" accent={DOMAIN_COLOR.strain} icon={<TrendingUp size={15} />}>
      <Card className="tint p-5" style={{ ["--accent" as string]: c }}>
        {tl.available ? (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <IconBadge color={c} size={46}><TrendingUp size={20} /></IconBadge>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-semibold text-ink-50">{tl.label}</span>
                  <StatusPill text={`${tl.ratio.toFixed(2)}× ratio`} color={c} />
                  <ConfidenceBadge level={tl.confidence} />
                </div>
                <p className="mt-0.5 text-[11px] text-ink-400">acute:chronic ratio — around 0.8–1.3 is a balanced, sustainable zone</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Bar label="Acute · last 7 days" value={tl.acute} fill={c} />
              <Bar label="Chronic · last 28 days" value={tl.chronic} fill="#c8bba2" />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-ink-300">{tl.guidance}</p>
            {tl.confidence !== "high" && (
              <p className="mt-2 text-[11px] text-ink-500">Based on {tl.chronicDays} days so far — this sharpens as your history fills in.</p>
            )}
          </>
        ) : (
          <div className="flex items-center gap-3">
            <IconBadge color="#a4977f" size={40}><TrendingUp size={18} /></IconBadge>
            <p className="text-xs leading-relaxed text-ink-400">{tl.guidance}</p>
          </div>
        )}
      </Card>
    </Section>
  );
}

function ActivityRow({ a, restHr, maxHr }: { a: Activity; restHr: number; maxHr: number }) {
  const resolveActivity = useApp((s) => s.resolveActivity);
  const [editing, setEditing] = useState(false);
  const [newType, setNewType] = useState("Football");
  const needsReview = a.confidence === "low" && !a.resolved;
  const excluded = a.confidence === "low" && a.resolved !== "confirmed" && a.resolved !== "edited";
  // Show the same personalised load the score uses (HR-reserve based).
  const load = a.avgHr > 0 ? estimateActivityLoad(a.durationMin, a.avgHr, restHr, maxHr) : a.load;

  return (
    <Card className={cn("p-4", excluded && !needsReview && "opacity-55")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-ink-50">{a.type}</span>
        <ConfidenceBadge level={a.confidence} />
        {excluded && !needsReview && <span className="text-[11px] text-ink-500">excluded from strain</span>}
        <span className="tabular ml-auto text-sm font-bold" style={{ color: DOMAIN_COLOR.strain }}>
          {a.confidence === "low" && a.resolved !== "confirmed" && a.resolved !== "edited" ? "—" : load.toFixed(1)}
        </span>
      </div>
      <div className="mt-1.5 text-xs text-ink-400">
        {fmtTime(a.start.slice(11, 16))} · {a.durationMin}m
        {a.avgHr > 0 ? ` · avg ${a.avgHr}${a.maxHr > 0 ? ` / max ${a.maxHr}` : ""} bpm` : ""} · {fmtNum(a.calories)} kcal
      </div>
      {a.zones.some((z) => z > 0) && (
        <div className="mt-3">
          <ZoneBars zones={a.zones} />
        </div>
      )}
      {needsReview && (
        <div className="mt-3 rounded-xl border border-warn/25 bg-warn/[0.06] p-3">
          <p className="text-xs leading-relaxed text-ink-200">
            Short elevated-HR block detected. It is <span className="font-semibold">not counted as a workout</span>{" "}
            unless you confirm it — stress, caffeine or a hot shower can look like this.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              onClick={() => resolveActivity(a.id, "ignored")}
              className="rounded-full border border-black/15 px-3 py-1.5 text-xs font-medium text-ink-200 hover:bg-black/[0.07]"
            >
              Ignore
            </button>
            <button
              onClick={() => resolveActivity(a.id, "confirmed")}
              className="rounded-full bg-black/10 px-3 py-1.5 text-xs font-medium text-ink-50 hover:bg-black/[0.16]"
            >
              Confirm as workout
            </button>
            {!editing ? (
              <button onClick={() => setEditing(true)} className="rounded-full border border-black/15 px-3 py-1.5 text-xs font-medium text-ink-200 hover:bg-black/[0.07]">
                Edit type…
              </button>
            ) : (
              <span className="flex items-center gap-1.5">
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="h-8 rounded-lg border border-black/15 bg-ink-800 px-2 text-xs text-ink-100 outline-none"
                >
                  {["Football", "Running", "Gym", "Walking", "Cycling", "Other"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <button
                  onClick={() => resolveActivity(a.id, "edited", newType)}
                  className="rounded-full bg-black/10 px-3 py-1.5 text-xs font-medium text-ink-50 hover:bg-black/[0.16]"
                >
                  Save
                </button>
              </span>
            )}
          </div>
          <p className="mt-2 text-[10px] text-ink-500">Your corrections refine how activities are detected.</p>
        </div>
      )}
    </Card>
  );
}

export default function StrainPage() {
  const birthYear = useApp((s) => s.settings.birthYear);
  const maxHr = maxHrFromAge(ageFromBirthYear(birthYear));
  return (
    <ScorePage
      title="Strain"
      question="How much load did you put on your body today?"
      color={DOMAIN_COLOR.strain}
      ringLabel="Strain"
      pick={(s) => s.strain}
      baselineLabel={(s) => `Your typical daily strain is ${s.baseline} over the last two weeks (0–21 scale).`}
      algoNote="Each workout's load is personalised to your heart-rate reserve — how hard the session was relative to YOUR resting and max heart rate — so the same effort scores by your own fitness, not a generic scale. Strain sums those plus a term for all-day movement from your steps; unrecognized short HR spikes are excluded unless you confirm them."
      belowHero={(data) => {
        const rec = data.today!.recovery;
        const t = strainTarget(rec.available === false ? null : rec.score, data.today!.baseline.strain);
        if (!t.available) return null;
        const cur = data.today!.strain.available === false ? 0 : data.today!.strain.score;
        const pct = Math.min(100, (cur / Math.max(1, t.high)) * 100);
        return (
          <Section title="Today's target" sub="How hard to go today — from your recovery">
            <Card className="p-5">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${DOMAIN_COLOR.strain}1f`, color: DOMAIN_COLOR.strain }}>
                  <Flame size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold text-ink-50">{t.headline}</div>
                  <div className="text-[11px] text-ink-400">Aim for a strain of {t.low.toFixed(1)}–{t.high.toFixed(1)}</div>
                </div>
                <div className="text-right">
                  <div className="tabular text-3xl font-bold leading-none" style={{ color: DOMAIN_COLOR.strain }}>{t.target.toFixed(1)}</div>
                  <div className="text-[10px] uppercase tracking-wide text-ink-500">target</div>
                </div>
              </div>
              {/* current vs target bar */}
              <div className="mt-4">
                <div className="relative h-2 overflow-hidden rounded-full bg-black/[0.06]">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: DOMAIN_COLOR.strain }} />
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-ink-400"><span>now {cur.toFixed(1)}</span><span>target {t.target.toFixed(1)}</span></div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink-400">{t.guidance}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {t.activities.map((a) => (
                  <span key={a} className="rounded-full border border-black/[0.08] bg-black/[0.02] px-3 py-1.5 text-[11px] font-medium text-ink-200">{a}</span>
                ))}
              </div>
              {/* Close the loop: plan a session and see where it lands you vs target */}
              <div className="mt-5 border-t border-black/[0.06] pt-4">
                <SessionPlanner current={cur} target={t} restHr={data.today!.baseline.rhrBpm} maxHr={maxHr} />
              </div>
            </Card>
          </Section>
        );
      }}
      extras={(data) => {
        const acts = data.today!.day.activities;
        const counted = countedActivities(data.today!.day);
        const tl = trainingLoad(data.days);
        return (
          <>
          <TrainingLoadSection tl={tl} />
          {counted.length > 0 && (
            <Section title="Strain through the day" sub="How your load accumulated across the day">
              <Card>
                <StrainCurve activities={counted} color={DOMAIN_COLOR.strain} />
              </Card>
            </Section>
          )}
          <Section title="Activity breakdown" sub="Per-activity load — low-confidence blocks need your review">
            {acts.length ? (
              <div className="space-y-3">
                {acts.map((a) => (
                  <ActivityRow key={a.id} a={a} restHr={data.today!.baseline.rhrBpm} maxHr={maxHr} />
                ))}
              </div>
            ) : (
              <EmptyState icon={<Flame size={20} />} title="No activity yet today" body="Move, and your load breakdown will appear here by activity." />
            )}
          </Section>
          </>
        );
      }}
    />
  );
}
