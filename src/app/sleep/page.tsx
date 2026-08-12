"use client";

import { ScorePage } from "@/components/score-page";
import { Card, Delta, Section } from "@/components/ui";
import { Hypnogram, SleepStagesBar } from "@/components/charts";
import { DOMAIN_COLOR, fmtDuration, fmtTime } from "@/lib/format";

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-black/[0.05] bg-black/[0.02] px-3.5 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-500">{label}</div>
      <div className="tabular mt-1 text-lg font-semibold text-ink-50">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-ink-400">{hint}</div>}
    </div>
  );
}

export default function SleepPage() {
  return (
    <ScorePage
      title="Sleep"
      question="How well did last night restore you?"
      color={DOMAIN_COLOR.sleep}
      ringLabel="Sleep"
      pick={(s) => s.sleep}
      baselineLabel={(s) => `You typically sleep ${s.baseline}h a night over the last two weeks.`}
      algoNote="Duration vs your personal need, efficiency, deep + REM share, timing consistency and awakenings each contribute signed points. Weights are placeholders until the final sleep model is designed."
      extras={(data) => {
        const s = data.today!.day.sleep;
        const rec = data.today!.recovery;
        const en = data.today!.energy;
        const sleepPtsRec = rec.contributors.find((c) => c.label === "Sleep")?.points ?? 0;
        const sleepPtsEn = en.contributors.find((c) => c.label === "Sleep")?.points ?? 0;
        return (
          <>
            <Section title="Last night" sub={`${fmtTime(s.bedtime.slice(11, 16))} → ${fmtTime(s.wake.slice(11, 16))}`}>
              <Card>
                {s.segments && s.segments.length > 3 && (
                  <div className="mb-4">
                    <Hypnogram segments={s.segments} bedtime={s.bedtime} wake={s.wake} />
                  </div>
                )}
                <SleepStagesBar stages={s.stages} />
                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <Fact label="Asleep" value={fmtDuration(s.asleepMin)} hint={`need ${fmtDuration(s.needMin)}`} />
                  <Fact label="In bed" value={fmtDuration(s.inBedMin)} hint={`${s.efficiencyPct}% efficient`} />
                  <Fact label="Awakenings" value={String(s.awakenings)} hint={`${fmtDuration(s.stages.awake)} awake`} />
                  <Fact label="Sleep debt" value={fmtDuration(s.debtMin)} hint="rolling shortfall" />
                  <Fact label="Consistency" value={`${s.consistencyPct}%`} hint="timing regularity" />
                  <Fact label="Sleep HR" value={`${s.sleepHrBpm} bpm`} hint="overnight average" />
                  <Fact label="Overnight HRV" value={`${s.overnightHrvMs} ms`} />
                  <Fact label="Bedtime" value={fmtTime(s.bedtime.slice(11, 16))} />
                </div>
              </Card>
            </Section>

            <Section title="How it rippled" sub="Last night's sleep inside today's other scores">
              <div className="grid gap-3 sm:grid-cols-2">
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-ink-100">Into Recovery</span>
                    <Delta value={sleepPtsRec} suffix=" pts" />
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-400">
                    Sleep contributed {sleepPtsRec >= 0 ? "positively" : "negatively"} to this morning&apos;s {rec.score}% recovery.
                  </p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-ink-100">Into Energy</span>
                    <Delta value={sleepPtsEn} suffix=" pts" />
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-400">
                    It {sleepPtsEn >= 0 ? "charged" : "drained"} today&apos;s battery, which currently reads {en.score}.
                  </p>
                </Card>
              </div>
            </Section>
          </>
        );
      }}
    />
  );
}
