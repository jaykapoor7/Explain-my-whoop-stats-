"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Activity, BedDouble, Dumbbell, FlaskConical, HeartPulse } from "lucide-react";
import { useApp } from "@/lib/store";
import { RequireData } from "@/components/require-data";
import { Badge, Card, CardTitle, FadeIn, SectionHeading } from "@/components/ui";
import { dailyBriefing, experimentIdeas, monthlyReport, suggestions, weeklyReport, PeriodReport } from "@/lib/coach";
import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  green: { ring: "border-status-good/30", bg: "bg-status-good/[0.07]", text: "text-[#5ecb5e]", label: "Green day" },
  yellow: { ring: "border-status-warning/30", bg: "bg-status-warning/[0.07]", text: "text-[#f7c95c]", label: "Yellow day" },
  red: { ring: "border-status-critical/30", bg: "bg-status-critical/[0.07]", text: "text-[#f28b8b]", label: "Red day" },
} as const;

const AREA_ICON = { training: Dumbbell, sleep: BedDouble, recovery: HeartPulse } as const;

function ReportCard({ report }: { report: PeriodReport }) {
  return (
    <Card>
      <CardTitle>{report.title}</CardTitle>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {report.stats.map((s) => (
          <div key={s.label}>
            <div className="text-[11px] uppercase tracking-wider text-base-400">{s.label}</div>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="text-lg font-semibold tabular">{s.value}</span>
              <span
                className={cn(
                  "text-xs tabular",
                  s.good === true && "text-[#5ecb5e]",
                  s.good === false && "text-[#f28b8b]",
                  s.good == null && "text-base-400"
                )}
              >
                {s.delta}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2 border-t border-white/[0.06] pt-4">
        {report.narrative.map((n, i) => (
          <p key={i} className="text-sm leading-relaxed text-base-300">
            {n}
          </p>
        ))}
      </div>
    </Card>
  );
}

function CoachBody() {
  const days = useApp((s) => s.days);
  const briefing = useMemo(() => dailyBriefing(days), [days]);
  const weekly = useMemo(() => weeklyReport(days), [days]);
  const monthly = useMemo(() => monthlyReport(days), [days]);
  const suggs = useMemo(() => suggestions(days), [days]);
  const ideas = useMemo(() => experimentIdeas(days), [days]);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">AI Coach</h1>
      <p className="mt-1 text-sm text-base-400">
        A performance coach&apos;s read on your data — trends over single days, suggestions over prescriptions.
      </p>

      {briefing && (
        <FadeIn className="mt-6">
          <div className={cn("card border p-6", STATUS_STYLES[briefing.status].ring, STATUS_STYLES[briefing.status].bg)}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{briefing.title}</h2>
              <Badge tone={briefing.status === "green" ? "good" : briefing.status === "yellow" ? "warning" : "critical"}>
                {STATUS_STYLES[briefing.status].label}
              </Badge>
            </div>
            <p className={cn("mt-2 text-sm font-medium", STATUS_STYLES[briefing.status].text)}>{briefing.summary}</p>
            <ul className="mt-3 space-y-1.5">
              {briefing.bullets.map((b, i) => (
                <li key={i} className="flex gap-2 text-sm text-base-200">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-base-400" />
                  {b}
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-xl bg-base-950/50 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-base-400">
                <Activity size={13} /> Today&apos;s call
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-base-100">{briefing.action}</p>
            </div>
          </div>
        </FadeIn>
      )}

      <SectionHeading title="Suggestions" subtitle="Ranked by what your data says will move the needle" />
      <div className="grid gap-3 md:grid-cols-2">
        {suggs.map((s, i) => {
          const Icon = AREA_ICON[s.area];
          return (
            <FadeIn key={i} delay={i * 0.05}>
              <Card className="flex h-full gap-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent-soft">
                  <Icon size={16} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wider text-base-400">{s.area}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium leading-snug">{s.text}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-base-400">{s.why}</p>
                </div>
              </Card>
            </FadeIn>
          );
        })}
        {!suggs.length && (
          <Card className="text-sm text-base-400 md:col-span-2">
            Nothing urgent — your recent block looks balanced. Keep logging and check back after a heavier week.
          </Card>
        )}
      </div>

      <SectionHeading title="Reports" />
      <div className="grid gap-3 lg:grid-cols-2">
        {weekly && (
          <FadeIn>
            <ReportCard report={weekly} />
          </FadeIn>
        )}
        {monthly && (
          <FadeIn delay={0.06}>
            <ReportCard report={monthly} />
          </FadeIn>
        )}
      </div>

      <SectionHeading title="Personalized experiments" subtitle="Generated from the strongest patterns in your data" />
      <div className="grid gap-3 sm:grid-cols-2">
        {ideas.map((idea, i) => (
          <FadeIn key={idea.name} delay={i * 0.05}>
            <Link href="/experiments" className="block h-full">
              <Card className="group h-full transition hover:border-accent/30">
                <div className="flex items-center gap-2 text-accent-soft">
                  <FlaskConical size={15} />
                  <span className="text-sm font-semibold text-white">{idea.name}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-base-300">{idea.description}</p>
                <p className="mt-2 text-[11px] font-medium text-accent-soft opacity-0 transition group-hover:opacity-100">
                  Start in Experiment Mode →
                </p>
              </Card>
            </Link>
          </FadeIn>
        ))}
      </div>

      <p className="mt-10 text-xs leading-relaxed text-base-400">
        The coach reads patterns in your data like an experienced trainer would — it does not diagnose conditions or
        replace medical advice. If something looks persistently off (resting HR climbing for weeks, unexplained
        fatigue), bring it to a qualified healthcare professional.
      </p>
    </div>
  );
}

export default function CoachPage() {
  return (
    <RequireData>
      <CoachBody />
    </RequireData>
  );
}
