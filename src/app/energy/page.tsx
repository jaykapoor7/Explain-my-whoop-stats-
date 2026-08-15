"use client";

import { ScorePage } from "@/components/score-page";
import { Card, Section } from "@/components/ui";
import { ENERGY_NEUTRAL_BASE } from "@/lib/scoring/energy";
import { DOMAIN_COLOR } from "@/lib/format";
import { BatteryCharging, Minus, Plus } from "lucide-react";

export default function EnergyPage() {
  return (
    <ScorePage
      title="Energy"
      question="How much physiological capacity do you have available right now?"
      color={DOMAIN_COLOR.energy}
      ringLabel="Energy"
      pick={(s) => s.energy}
      baselineLabel={(s) => `Your 14-day typical energy is ${s.baseline}. Sleep and recovery charge the battery; activity spends it.`}
      algoNote="Sleep quality, HRV and this morning's recovery charge the score; each counted activity draws it down in proportion to its load."
      belowHero={(data) => {
        const e = data.today!.energy;
        if (e.available === false) return null;
        const charged = Math.round(e.contributors.reduce((s, c) => s + Math.max(0, c.points), 0));
        const spent = Math.round(Math.abs(e.contributors.reduce((s, c) => s + Math.min(0, c.points), 0)));
        const score = Math.round(e.score);
        const col = DOMAIN_COLOR.energy;
        const vsBaseline = score - e.baseline;
        return (
          <Section title="Your energy battery" sub="Exactly how today's number is built">
            <Card className="p-5">
              {/* The battery */}
              <div className="flex items-center gap-3">
                <BatteryCharging size={20} style={{ color: col }} />
                <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                  <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: `linear-gradient(90deg, ${col}bb, ${col})` }} />
                </div>
                <span className="tabular w-12 text-right text-lg font-bold" style={{ color: col }}>{score}</span>
              </div>

              {/* The equation — start, charge, spend → the battery above is the result */}
              <div className="mt-5 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-start gap-x-2 text-center">
                <MathCell top="Neutral start" val={`${ENERGY_NEUTRAL_BASE}`} sub="an average day" />
                <Op icon={<Plus size={14} />} />
                <MathCell top="Charged" val={`+${charged}`} sub="sleep · recovery · HRV" color="#13b57e" />
                <Op icon={<Minus size={14} />} />
                <MathCell top="Spent" val={`−${spent}`} sub="today's activity" color={DOMAIN_COLOR.strain} />
              </div>
              <p className="mt-2 text-center text-[11px] text-ink-400">
                = <span className="font-semibold" style={{ color: col }}>{score}</span> — your energy right now, shown above.
              </p>

              {/* Plain-English explanation of the baseline */}
              <div className="mt-5 space-y-2 rounded-xl bg-black/[0.03] p-4 text-xs leading-relaxed text-ink-300">
                <p>
                  Energy starts every day at a neutral <span className="font-semibold text-ink-100">{ENERGY_NEUTRAL_BASE}</span> — a
                  blank, average day. Good sleep, a strong recovery and higher-than-usual HRV{" "}
                  <span className="font-semibold" style={{ color: "#13b57e" }}>charge</span> it up; the harder you train, the more it{" "}
                  <span className="font-semibold" style={{ color: DOMAIN_COLOR.strain }}>spends</span> back down.
                </p>
                <p>
                  Your <span className="font-semibold text-ink-100">baseline</span> — the dashed line on the trend below — is your own{" "}
                  <span className="font-semibold text-ink-100">14-day typical energy ({e.baseline})</span>, not a fixed target. Today you&apos;re{" "}
                  {vsBaseline === 0 ? (
                    <span className="font-semibold text-ink-100">right on it</span>
                  ) : (
                    <span className="font-semibold" style={{ color: vsBaseline > 0 ? "#13b57e" : DOMAIN_COLOR.strain }}>
                      {Math.abs(vsBaseline)} {vsBaseline > 0 ? "above" : "below"}
                    </span>
                  )}{" "}
                  your normal. The signed factors under &ldquo;What affected you&rdquo; are the exact charge and spend amounts.
                </p>
              </div>
            </Card>
          </Section>
        );
      }}
    />
  );
}

function MathCell({ top, val, sub, color, strong }: { top: string; val: string; sub: string; color?: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-wide text-ink-500">{top}</div>
      <div className={strong ? "tabular text-2xl font-bold leading-tight" : "tabular text-xl font-bold leading-tight text-ink-50"} style={color ? { color } : undefined}>{val}</div>
      <div className="truncate text-[10px] text-ink-400">{sub}</div>
    </div>
  );
}

function Op({ icon }: { icon: React.ReactNode }) {
  return <span className="flex h-5 w-5 items-center justify-center text-ink-400">{icon}</span>;
}
