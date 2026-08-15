"use client";

import { ScorePage } from "@/components/score-page";
import { Card, Section } from "@/components/ui";
import { energySplit } from "@/lib/scoring/energy";
import { DOMAIN_COLOR } from "@/lib/format";
import { BatteryCharging, Minus, Sunrise } from "lucide-react";

export default function EnergyPage() {
  return (
    <ScorePage
      title="Energy"
      question="How much physiological capacity do you have available right now?"
      color={DOMAIN_COLOR.energy}
      ringLabel="Energy"
      pick={(s) => s.energy}
      baselineLabel={(s) => `Your 14-day typical energy is ${s.baseline}. Sleep, recovery and yesterday's load set your morning capacity; today's activity spends it.`}
      algoNote="Your morning capacity is built from last night's sleep, this morning's recovery and HRV, and how hard you went yesterday; each counted activity then draws it down."
      belowHero={(data) => {
        const e = data.today!.energy;
        if (e.available === false) return null;
        const { morningCapacity, spent } = energySplit(e);
        const score = Math.round(e.score);
        const col = DOMAIN_COLOR.energy;
        const vsBaseline = morningCapacity - e.baseline;
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

              {/* The equation — woke with capacity, spent on activity, have this left */}
              <div className="mt-5 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-start gap-x-2 text-center">
                <MathCell top="Woke with" val={`${morningCapacity}`} sub="morning capacity" color="#13b57e" icon={<Sunrise size={12} />} />
                <Op icon={<Minus size={14} />} />
                <MathCell top="Spent" val={`${spent}`} sub="today's activity" color={DOMAIN_COLOR.strain} />
                <Op icon={<span className="text-sm font-bold">=</span>} />
                <MathCell top="Energy now" val={`${score}`} sub="available" color={col} strong />
              </div>

              {/* Plain-English explanation */}
              <div className="mt-5 space-y-2 rounded-xl bg-black/[0.03] p-4 text-xs leading-relaxed text-ink-300">
                <p>
                  You don&apos;t start every day at the same place. This morning your body woke with a capacity of{" "}
                  <span className="font-semibold" style={{ color: "#13b57e" }}>{morningCapacity}</span> — built from{" "}
                  <span className="font-semibold text-ink-100">last night&apos;s sleep</span>,{" "}
                  <span className="font-semibold text-ink-100">this morning&apos;s recovery &amp; HRV</span>, and{" "}
                  <span className="font-semibold text-ink-100">how hard you went yesterday</span> (a big day leaves residual fatigue). That&apos;s how much you can expend today.
                </p>
                <p>
                  Since waking, activity has <span className="font-semibold" style={{ color: DOMAIN_COLOR.strain }}>spent {spent}</span>, leaving{" "}
                  <span className="font-semibold" style={{ color: col }}>{score}</span> in the tank. Your{" "}
                  <span className="font-semibold text-ink-100">baseline</span> — the dashed line below — is your own 14-day typical energy ({e.baseline}); this morning you woke{" "}
                  {vsBaseline === 0 ? (
                    <span className="font-semibold text-ink-100">right on it</span>
                  ) : (
                    <span className="font-semibold" style={{ color: vsBaseline > 0 ? "#13b57e" : DOMAIN_COLOR.strain }}>
                      {Math.abs(vsBaseline)} {vsBaseline > 0 ? "above" : "below"} it
                    </span>
                  )}
                  . Tap any factor under &ldquo;What affected you&rdquo; to see its exact maths.
                </p>
              </div>
            </Card>
          </Section>
        );
      }}
    />
  );
}

function MathCell({ top, val, sub, color, strong, icon }: { top: string; val: string; sub: string; color?: string; strong?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-center gap-1 text-[10px] font-medium uppercase tracking-wide text-ink-500">{icon}{top}</div>
      <div className={strong ? "tabular text-2xl font-bold leading-tight" : "tabular text-xl font-bold leading-tight text-ink-50"} style={color ? { color } : undefined}>{val}</div>
      <div className="truncate text-[10px] text-ink-400">{sub}</div>
    </div>
  );
}

function Op({ icon }: { icon: React.ReactNode }) {
  return <span className="mt-3 flex h-5 w-5 items-center justify-center text-ink-400">{icon}</span>;
}
