"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { Card, ContributorLedger, Delta, PageHeader, ScoreRing, Section, SkeletonPage, StatusPill, Why } from "@/components/ui";
import { TrendArea } from "@/components/charts";
import { ConnectGate } from "@/components/connect";
import { DaySwitcher } from "@/components/day-switcher";
import { useHealth } from "@/lib/data/use-health";
import { ScoredDay } from "@/lib/scoring/engine";
import { ScoreResult } from "@/lib/types";
import { cn, fmtDateLong, signed } from "@/lib/format";

/**
 * Shared layout for the four score pages. Answers, in order:
 * WHAT IS MY STATE? → WHY? → WHAT CHANGED? → WHAT CAN I LEARN?
 */
export function ScorePage({
  title,
  question,
  color,
  pick,
  baselineLabel,
  ringLabel,
  algoNote,
  neutralBase,
  belowHero,
  extras,
}: {
  title: string;
  question: string;
  color: string;
  pick: (s: ScoredDay) => ScoreResult;
  baselineLabel: (score: ScoreResult) => string;
  ringLabel: string;
  algoNote: string;
  /** The neutral midpoint the score is built around. When set, a compact
   * "neutral → today's factors → score" strip is shown under the hero so the
   * maths is legible the same way the Energy battery is. */
  neutralBase?: number;
  belowHero?: (data: ReturnType<typeof useHealth>) => ReactNode;
  extras?: (data: ReturnType<typeof useHealth>) => ReactNode;
}) {
  const data = useHealth();
  const [range, setRange] = useState<7 | 30>(7);

  if (!data.hydrated) return <SkeletonPage />;
  if (!data.today) {
    return (
      <div className="animate-fadeUp">
        <PageHeader title={title} sub={question} back />
        <ConnectGate title={title} />
      </div>
    );
  }

  const score = pick(data.today);
  const trend = data.days
    .slice(-range)
    .filter((s) => pick(s).available !== false)
    .map((s) => ({ date: s.day.date, value: pick(s).score }));

  if (score.available === false) {
    return (
      <div className="animate-fadeUp">
        <PageHeader title={title} sub={question} right={<DaySwitcher />} back />
        <Card className="mt-5 p-6 text-center">
          <p className="text-sm font-semibold text-ink-100">No {title.toLowerCase()} data for today</p>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-ink-400">{score.explanation}</p>
          <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-ink-500">
            Rather than show a made-up number, this stays blank until the data syncs. Check{" "}
            <Link href="/settings" className="text-ink-300 underline hover:text-ink-100">
              Settings → Sync diagnostics
            </Link>{" "}
            to see which metrics came through.
          </p>
        </Card>
        {trend.length > 1 && (
          <Section title="Recent history" sub={`Days that did sync · last ${range}`}>
            <Card>
              <TrendArea data={trend} color={color} domain={score.scale === 21 ? [0, 21] : [0, 100]} name={title} />
            </Card>
          </Section>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fadeUp">
      <PageHeader title={title} sub={question} right={<DaySwitcher />} back />

      <Card className="mt-5 overflow-hidden" style={{ background: `linear-gradient(135deg, ${color}12, ${color}03 45%, transparent)` }}>
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-7">
          <ScoreRing score={score.score} scale={score.scale} color={color} label={ringLabel} />
          <div className="w-full min-w-0 flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <StatusPill text={score.status} color={color} />
              <span className="text-xs text-ink-400">
                vs yesterday <Delta value={score.deltaVsYesterday} decimals={score.scale === 21 ? 1 : 0} />
              </span>
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-ink-200">{score.explanation}</p>
            <p className="mt-1.5 text-xs text-ink-400">{baselineLabel(score)}</p>
          </div>
        </div>
        <Why summary={`Why is my ${title.toLowerCase()} ${score.scale === 21 ? score.score.toFixed(1) : Math.round(score.score)} today?`}>
          Each factor below moves the score up or down from a neutral middle; the signed points sum to today&apos;s
          value. {algoNote}
        </Why>
      </Card>

      {typeof neutralBase === "number" && score.scale === 100 && (
        <ScoreMath title={title} base={neutralBase} score={Math.round(score.score)} color={color} baseline={score.baseline} />
      )}

      {belowHero?.(data)}

      <Section title="What affected you" sub="Signed contributions — these sum to today's score">
        <Card>
          <ContributorLedger contributors={score.contributors} />
        </Card>
      </Section>

      <Section
        title="Trend"
        sub={`Dashed line is your ${range}-day baseline`}
        action={<RangeToggle range={range} setRange={setRange} />}
      >
        <Card>
          <TrendArea
            data={trend}
            color={color}
            baseline={typeof score.baseline === "number" && score.scale === 100 ? score.baseline : undefined}
            domain={score.scale === 21 ? [0, 21] : [0, 100]}
            name={title}
          />
        </Card>
      </Section>

      {extras?.(data)}

      <p className="mt-8 text-center text-[11px] leading-relaxed text-ink-500">
        {fmtDateLong(data.today.day.date)} · not medical advice.
      </p>
    </div>
  );
}

/** Compact "neutral → today's factors → score" strip, so every score reads the
 * same way as the Energy battery: a neutral midpoint that the day moves off. */
function ScoreMath({ title, base, score, color, baseline }: { title: string; base: number; score: number; color: string; baseline: number }) {
  const net = score - base;
  const lc = title.toLowerCase();
  return (
    <Card className="mt-4 p-5">
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-start gap-x-2 text-center">
        <MathCell top="Neutral" val={`${base}`} sub={`an average ${lc} day`} />
        <MathOp icon={net >= 0 ? "+" : "−"} />
        <MathCell top="Today's factors" val={`${net >= 0 ? "+" : "−"}${Math.abs(net)}`} sub="net of all below" color={net >= 0 ? "#13b57e" : "#ef5a45"} />
        <MathOp icon="=" />
        <MathCell top={title} val={`${score}`} sub="today" color={color} strong />
      </div>
      <p className="mt-4 rounded-xl bg-black/[0.03] p-4 text-xs leading-relaxed text-ink-300">
        Your {lc} starts at a neutral <span className="font-semibold text-ink-100">{base}</span> — a middling day.
        Every factor under &ldquo;What affected you&rdquo; is a signed move off that base, and they sum to{" "}
        <span className="font-semibold" style={{ color: net >= 0 ? "#13b57e" : "#ef5a45" }}>{signed(net)}</span>, giving today&apos;s{" "}
        <span className="font-semibold" style={{ color }}>{score}</span>. Your{" "}
        <span className="font-semibold text-ink-100">baseline</span> — the dashed line on the trend — is your own 14-day
        typical ({baseline}{title === "Recovery" ? "%" : ""}), not a fixed target. Tap any factor to see its maths.
      </p>
    </Card>
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

function MathOp({ icon }: { icon: string }) {
  return <span className="mt-3 flex h-5 w-5 items-center justify-center text-sm font-bold text-ink-400">{icon}</span>;
}

export function RangeToggle({ range, setRange, options = [7, 30] }: { range: number; setRange: (r: never) => void; options?: number[] }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-black/[0.08] text-xs">
      {options.map((r) => (
        <button
          key={r}
          onClick={() => setRange(r as never)}
          className={cn("px-3 py-1.5 font-medium transition-colors", range === r ? "bg-black/[0.1] text-ink-50" : "text-ink-400 hover:text-ink-200")}
        >
          {r}d
        </button>
      ))}
    </div>
  );
}
