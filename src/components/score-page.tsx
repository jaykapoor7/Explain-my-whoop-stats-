"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { Card, ContributorLedger, Delta, PageHeader, ScoreRing, Section, SkeletonPage, StatusPill, Why } from "@/components/ui";
import { TrendArea } from "@/components/charts";
import { ConnectGate } from "@/components/connect";
import { useHealth } from "@/lib/data/use-health";
import { ScoredDay } from "@/lib/scoring/engine";
import { ScoreResult } from "@/lib/types";
import { cn, fmtDateLong } from "@/lib/format";

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
  extras,
}: {
  title: string;
  question: string;
  color: string;
  pick: (s: ScoredDay) => ScoreResult;
  baselineLabel: (score: ScoreResult) => string;
  ringLabel: string;
  algoNote: string;
  extras?: (data: ReturnType<typeof useHealth>) => ReactNode;
}) {
  const data = useHealth();
  const [range, setRange] = useState<7 | 30>(7);

  if (!data.hydrated) return <SkeletonPage />;
  if (!data.today) {
    return (
      <div className="animate-fadeUp">
        <PageHeader title={title} sub={question} />
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
        <PageHeader title={title} sub={question} />
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
      <PageHeader title={title} sub={question} />

      <Card className="mt-5">
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
        {fmtDateLong(data.today.day.date)} · scoring is a deterministic placeholder — the final model is designed
        separately. Not medical advice.
      </p>
    </div>
  );
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
