"use client";

import { useState } from "react";
import { ScorePage } from "@/components/score-page";
import { Card, ConfidenceBadge, EmptyState, Section } from "@/components/ui";
import { StrainCurve, ZoneBars } from "@/components/charts";
import { useApp } from "@/lib/data/store";
import { countedActivities } from "@/lib/scoring/strain";
import { DOMAIN_COLOR, cn, fmtNum, fmtTime } from "@/lib/format";
import { Activity } from "@/lib/types";
import { Flame } from "lucide-react";

function ActivityRow({ a }: { a: Activity }) {
  const resolveActivity = useApp((s) => s.resolveActivity);
  const [editing, setEditing] = useState(false);
  const [newType, setNewType] = useState("Football");
  const needsReview = a.confidence === "low" && !a.resolved;
  const excluded = a.confidence === "low" && a.resolved !== "confirmed" && a.resolved !== "edited";

  return (
    <Card className={cn("p-4", excluded && !needsReview && "opacity-55")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-ink-50">{a.type}</span>
        <ConfidenceBadge level={a.confidence} />
        {excluded && !needsReview && <span className="text-[11px] text-ink-500">excluded from strain</span>}
        <span className="tabular ml-auto text-sm font-bold" style={{ color: DOMAIN_COLOR.strain }}>
          {a.confidence === "low" && a.resolved !== "confirmed" && a.resolved !== "edited" ? "—" : a.load.toFixed(1)}
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
          <p className="mt-2 text-[10px] text-ink-500">Your corrections will eventually teach activity detection.</p>
        </div>
      )}
    </Card>
  );
}

export default function StrainPage() {
  return (
    <ScorePage
      title="Strain"
      question="How much load did you put on your body today?"
      color={DOMAIN_COLOR.strain}
      ringLabel="Strain"
      pick={(s) => s.strain}
      baselineLabel={(s) => `Your typical daily strain is ${s.baseline} over the last two weeks (0–21 scale).`}
      algoNote="Strain sums each counted activity's load plus a small term for daily movement. Unrecognized short HR spikes are excluded unless you confirm them. The load model is a placeholder until the final strain algorithm is designed."
      extras={(data) => {
        const acts = data.today!.day.activities;
        const counted = countedActivities(data.today!.day);
        return (
          <>
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
                  <ActivityRow key={a.id} a={a} />
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
