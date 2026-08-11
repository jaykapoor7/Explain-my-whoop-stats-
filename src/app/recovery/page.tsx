"use client";

import { ScorePage } from "@/components/score-page";
import { Card, Delta, Section } from "@/components/ui";
import { TrendArea } from "@/components/charts";
import { DOMAIN_COLOR, fmtNum } from "@/lib/format";

export default function RecoveryPage() {
  return (
    <ScorePage
      title="Recovery"
      question="How prepared is your body for additional stress?"
      color={DOMAIN_COLOR.recovery}
      ringLabel="Recovery"
      pick={(s) => s.recovery}
      baselineLabel={(s) => `Your 14-day typical recovery is ${s.baseline}%.`}
      algoNote="Inputs: overnight HRV vs your baseline, resting heart rate vs baseline, last night's sleep score and consistency, and yesterday's strain. Weights are placeholders until the final recovery model is designed."
      extras={(data) => {
        const t = data.today!;
        const hrvTrend = data.days.slice(-30).map((s) => ({ date: s.day.date, value: s.day.hrv.rmssdMs }));
        const rhrTrend = data.days.slice(-30).map((s) => ({ date: s.day.date, value: s.day.rhr.bpm }));
        return (
          <Section title="Underlying signals" sub="The raw physiology behind the score · 30 days">
            <div className="grid gap-3 sm:grid-cols-2">
              <Card>
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-semibold text-ink-100">HRV</span>
                  <span className="tabular text-xs text-ink-400">
                    <span className="text-ink-100">{t.day.hrv.rmssdMs} ms</span> · typical {fmtNum(t.baseline.hrvMs)}{" "}
                    <Delta value={t.day.hrv.rmssdMs - t.baseline.hrvMs} />
                  </span>
                </div>
                <div className="mt-3">
                  <TrendArea data={hrvTrend} color={DOMAIN_COLOR.recovery} unit=" ms" height={150} baseline={Math.round(t.baseline.hrvMs)} name="HRV" />
                </div>
              </Card>
              <Card>
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-semibold text-ink-100">Resting HR</span>
                  <span className="tabular text-xs text-ink-400">
                    <span className="text-ink-100">{t.day.rhr.bpm} bpm</span> · typical {fmtNum(t.baseline.rhrBpm)}{" "}
                    <Delta value={t.day.rhr.bpm - t.baseline.rhrBpm} invert />
                  </span>
                </div>
                <div className="mt-3">
                  <TrendArea data={rhrTrend} color="#7dd3fc" unit=" bpm" height={150} baseline={Math.round(t.baseline.rhrBpm)} name="RHR" />
                </div>
              </Card>
            </div>
          </Section>
        );
      }}
    />
  );
}
