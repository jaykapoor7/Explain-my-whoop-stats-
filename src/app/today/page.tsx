"use client";

import Link from "next/link";
import { ArrowRight, Check, Footprints, Sparkles } from "lucide-react";
import { Card, ContributorLedger, Delta, PageHeader, ProgressBar, ScoreRing, Section, SkeletonPage, StatusPill, Why } from "@/components/ui";
import { FitbitCard } from "@/components/connect";
import { useHealth } from "@/lib/data/use-health";
import { DOMAIN_COLOR, fmtDateLong, fmtDuration, fmtNum, relativeDay, todayISO } from "@/lib/format";
import { ScoredDay } from "@/lib/scoring/engine";
import { ScoreResult } from "@/lib/types";

function NoDataRing({ size = 64 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border border-dashed border-white/15 text-ink-500"
      style={{ width: size, height: size }}
    >
      <span className="text-lg">—</span>
    </span>
  );
}

function ScoreTile({ href, label, score, color, unit }: { href: string; label: string; score: ScoreResult; color: string; unit?: string }) {
  const na = score.available === false;
  return (
    <Link href={href} className="group">
      <Card className="flex items-center gap-4 p-4 transition-all group-hover:-translate-y-0.5 group-hover:shadow-lift">
        {na ? <NoDataRing /> : <ScoreRing score={score.score} scale={score.scale} color={color} size={64} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-ink-100">{label}</span>
            {!na && <Delta value={score.deltaVsYesterday} decimals={score.scale === 21 ? 1 : 0} />}
          </div>
          <div className="mt-0.5 text-xs text-ink-400">
            {na ? "No data yet" : score.status}
            {!na && unit ? ` · ${unit}` : ""}
          </div>
        </div>
        <ArrowRight size={14} className="shrink-0 text-ink-500 transition-transform group-hover:translate-x-0.5" />
      </Card>
    </Link>
  );
}

function dayLedger(s: ScoredDay) {
  const seen = new Set<string>();
  const all = [...s.energy.contributors, ...s.recovery.contributors].filter((c) => {
    if (seen.has(c.label)) return false;
    seen.add(c.label);
    return Math.abs(c.points) >= 2;
  });
  return all.sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).slice(0, 6);
}

function explainDay(s: ScoredDay): string {
  const led = dayLedger(s);
  const ups = led.filter((c) => c.points > 0).map((c) => c.label.toLowerCase());
  const downs = led.filter((c) => c.points < 0).map((c) => c.label.toLowerCase());
  const sleepOk = s.sleep.available !== false;
  const recOk = s.recovery.available !== false;
  const enOk = s.energy.available !== false;

  const parts: string[] = [];
  if (sleepOk) {
    const sleepH = (s.day.sleep.asleepMin / 60).toFixed(1);
    parts.push(recOk ? `You slept ${sleepH}h and woke at ${s.recovery.score}% recovery.` : `You slept ${sleepH}h.`);
  } else if (recOk) {
    parts.push(`No sleep was recorded last night, but your morning recovery read ${s.recovery.score}%.`);
  } else {
    parts.push("No overnight sleep, HRV or resting-HR data has synced for today yet.");
  }
  if (enOk) parts.push(`Your battery is ${s.energy.score >= 60 ? "well charged" : s.energy.score >= 40 ? "partly charged" : "running low"}.`);
  if (ups.length) parts.push(`Working for you: ${ups.slice(0, 3).join(", ")}.`);
  if (downs.length) parts.push(`Working against you: ${downs.slice(0, 3).join(", ")}.`);
  return parts.join(" ");
}

export default function TodayPage() {
  const data = useHealth();
  if (!data.hydrated) return <SkeletonPage />;

  const t = data.today;
  const goals = data.goals;
  const kcalGoal = goals.find((g) => g.kind === "calories")?.target ?? 2400;
  const proteinGoal = goals.find((g) => g.kind === "protein")?.target ?? 150;
  const stepsGoal = goals.find((g) => g.kind === "steps")?.target ?? 10000;

  const meds = data.todayMedEvents;
  const medsTaken = meds.filter((e) => e.status === "taken").length;
  const tasksToday = data.tasks.filter((x) => x.date === todayISO());
  const tasksDone = tasksToday.filter((x) => x.done).length;
  const mood = data.todayJournal?.ratings.mood;

  return (
    <div className="animate-fadeUp">
      <PageHeader
        title={t ? relativeDay(t.day.date) : "Welcome"}
        sub={t ? `${fmtDateLong(t.day.date)} — here's how you're doing.` : "Your Health OS — connect your Fitbit to bring it to life."}
      />

      {t ? (
        <>
          <Card className="mt-5">
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-7">
              {t.energy.available === false ? <NoDataRing size={96} /> : <ScoreRing score={t.energy.score} color={DOMAIN_COLOR.energy} label="Energy" />}
              <div className="w-full min-w-0 flex-1 text-center sm:text-left">
                {t.energy.available === false ? (
                  <>
                    <StatusPill text="No data yet" color={DOMAIN_COLOR.energy} />
                    <p className="mt-2.5 text-sm leading-relaxed text-ink-200">{t.energy.explanation}</p>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                      <StatusPill text={t.energy.status} color={DOMAIN_COLOR.energy} />
                      <span className="text-xs text-ink-400">
                        vs yesterday <Delta value={t.energy.deltaVsYesterday} /> · baseline {t.energy.baseline}
                      </span>
                    </div>
                    <p className="mt-2.5 text-sm leading-relaxed text-ink-200">{t.energy.explanation}</p>
                  </>
                )}
              </div>
            </div>
            <Why summary="Explain my day">{explainDay(t)}</Why>
          </Card>

          <Section title="What affected you" sub="The signed ledger behind today's state">
            <Card>
              <ContributorLedger contributors={dayLedger(t)} />
            </Card>
          </Section>

          <Section title="Scores">
            <div className="grid gap-3 sm:grid-cols-2">
              <ScoreTile href="/recovery" label="Recovery" score={t.recovery} color={DOMAIN_COLOR.recovery} />
              <ScoreTile href="/sleep" label="Sleep" score={t.sleep} color={DOMAIN_COLOR.sleep} unit={t.sleep.available === false ? undefined : fmtDuration(t.day.sleep.asleepMin)} />
              <ScoreTile href="/strain" label="Strain" score={t.strain} color={DOMAIN_COLOR.strain} />
              <ScoreTile href="/energy" label="Energy" score={t.energy} color={DOMAIN_COLOR.energy} />
            </div>
          </Section>
        </>
      ) : (
        <div className="mt-5">
          <FitbitCard autoSyncOnConnected />
        </div>
      )}

      <Section title="Today's essentials">
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/nutrition">
            <Card className="p-4 transition-all hover:-translate-y-0.5 hover:shadow-lift">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-semibold text-ink-100">Nutrition</span>
                <span className="tabular text-xs text-ink-400">
                  <span className="text-ink-100">{fmtNum(data.todayTotals.kcal)}</span> / {fmtNum(kcalGoal)} kcal
                </span>
              </div>
              <div className="mt-2.5">
                <ProgressBar value={data.todayTotals.kcal} max={kcalGoal} color={DOMAIN_COLOR.nutrition} invertOver />
              </div>
              <div className="mt-2 text-[11px] text-ink-400">
                Protein <span className="tabular text-ink-200">{data.todayTotals.protein}</span>/{proteinGoal}g · Carbs{" "}
                <span className="tabular text-ink-200">{data.todayTotals.carbs}</span>g · Fat{" "}
                <span className="tabular text-ink-200">{data.todayTotals.fat}</span>g
              </div>
            </Card>
          </Link>

          {t && (
            <Card className="p-4">
              <div className="flex items-baseline justify-between">
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-100">
                  <Footprints size={13} className="text-ink-400" /> Activity
                </span>
                <span className="tabular text-xs text-ink-400">
                  <span className="text-ink-100">{fmtNum(t.day.steps)}</span> / {fmtNum(stepsGoal)} steps
                </span>
              </div>
              <div className="mt-2.5">
                <ProgressBar value={t.day.steps} max={stepsGoal} color={DOMAIN_COLOR.strain} />
              </div>
              <div className="mt-2 text-[11px] text-ink-400">
                {fmtNum(t.day.activeCalories + t.day.restingCalories)} kcal burned ·{" "}
                {t.day.activities.filter((a) => a.confidence !== "low").length} activities
              </div>
            </Card>
          )}

          <Link href="/medication">
            <Card className="p-4 transition-all hover:-translate-y-0.5 hover:shadow-lift">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-semibold text-ink-100">Medication</span>
                <span className="tabular text-xs text-ink-400">
                  {meds.length ? (
                    <>
                      <span className="text-ink-100">{medsTaken}</span> / {meds.length} taken
                    </>
                  ) : (
                    "none set up"
                  )}
                </span>
              </div>
              <div className="mt-2.5">
                <ProgressBar value={medsTaken} max={Math.max(1, meds.length)} color="#e089d2" />
              </div>
              <div className="mt-2 text-[11px] text-ink-400">
                {meds.length ? (medsTaken === meds.length ? "All doses logged — nice." : `${meds.length - medsTaken} dose${meds.length - medsTaken > 1 ? "s" : ""} outstanding`) : "Add medications to track adherence"}
              </div>
            </Card>
          </Link>

          <Link href="/journal">
            <Card className="p-4 transition-all hover:-translate-y-0.5 hover:shadow-lift">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-semibold text-ink-100">Mood & journal</span>
                <span className="tabular text-xs text-ink-400">
                  {mood !== undefined ? <><span className="text-ink-100">{mood}</span> / 10</> : "not logged"}
                </span>
              </div>
              <div className="mt-2.5">
                <ProgressBar value={mood ?? 0} max={10} color="#c9b98a" />
              </div>
              <div className="mt-2 truncate text-[11px] text-ink-400">
                {data.todayJournal?.tags.map((x) => x.label).join(" · ") || "Tap to log how today went"}
              </div>
            </Card>
          </Link>
        </div>
      </Section>

      <Section title="Plan" action={<Link href="/planner" className="text-xs font-medium text-ink-300 hover:text-ink-100">Planner →</Link>}>
        <Card className="p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-semibold text-ink-100">Today</span>
            <span className="tabular text-xs text-ink-400">
              <span className="text-ink-100">{tasksDone}</span> / {tasksToday.length} done
            </span>
          </div>
          <div className="mt-3 space-y-1.5">
            {tasksToday.slice(0, 4).map((task) => (
              <div key={task.id} className="flex items-center gap-2 text-xs">
                <span className={task.done ? "text-good" : "text-ink-500"}>{task.done ? <Check size={12} /> : "○"}</span>
                <span className={task.done ? "text-ink-400 line-through" : "text-ink-200"}>{task.title}</span>
                {task.start && <span className="ml-auto tabular text-ink-500">{task.start}</span>}
              </div>
            ))}
            {!tasksToday.length && <p className="text-xs text-ink-400">Nothing scheduled — add tasks, classes or workouts in the Planner.</p>}
          </div>
        </Card>
      </Section>

      {data.insights[0] && (
        <Section title="From your patterns" action={<Link href="/trends" className="text-xs font-medium text-ink-300 hover:text-ink-100">All insights →</Link>}>
          <Card className="flex items-start gap-3 p-4">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-ink-200">
              <Sparkles size={15} />
            </span>
            <div>
              <p className="text-sm font-medium text-ink-100">{data.insights[0].title}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-400">{data.insights[0].detail}</p>
            </div>
          </Card>
        </Section>
      )}
    </div>
  );
}
