"use client";

import { Moon } from "lucide-react";
import { ScorePage } from "@/components/score-page";
import { Card, Delta, Section } from "@/components/ui";
import { Hypnogram, SleepStagesBar } from "@/components/charts";
import { sleepCoach } from "@/lib/scoring/sleep-coach";
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
      algoNote="Duration vs your personal need, deep and REM sleep, efficiency, restfulness, timing consistency and accrued sleep debt each contribute signed points."
      extras={(data) => {
        const s = data.today!.day.sleep;
        const rec = data.today!.recovery;
        const en = data.today!.energy;
        const sleepPtsRec = rec.contributors.find((c) => c.label === "Sleep")?.points ?? 0;
        const sleepPtsEn = en.contributors.find((c) => c.label === "Sleep")?.points ?? 0;
        const coach = sleepCoach(data.days.map((d) => d.day));
        return (
          <>
            {coach.available && (
              <Section title="Sleep coach" sub="Your personal sleep need, debt and tonight's bedtime">
                <Card className="p-5">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-4 sm:min-w-[220px] sm:border-r sm:border-black/[0.06] sm:pr-6">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${DOMAIN_COLOR.sleep}1f`, color: DOMAIN_COLOR.sleep }}>
                        <Moon size={24} />
                      </span>
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium uppercase tracking-wide text-ink-500">Suggested bedtime</div>
                        <div className="tabular text-[2rem] font-bold leading-tight text-ink-50">{fmtTime(coach.suggestedBedtime)}</div>
                        <div className="text-[11px] text-ink-400">to wake by {fmtTime(coach.suggestedWake)}</div>
                      </div>
                    </div>
                    <div className="grid flex-1 grid-cols-3 gap-2.5">
                      <Fact label="Tonight's need" value={fmtDuration(coach.tonightNeedMin)} hint={`${coach.efficiencyPct}% efficient`} />
                      <Fact label="Sleep debt" value={fmtDuration(coach.debtMin)} hint={coach.debtMin > 0 ? "to pay back" : "all clear"} />
                      <Fact label="Baseline need" value={fmtDuration(coach.baselineNeedMin)} hint="your typical" />
                    </div>
                  </div>
                  <p className="mt-4 text-xs leading-relaxed text-ink-400">{coach.rationale}</p>
                </Card>
              </Section>
            )}

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
