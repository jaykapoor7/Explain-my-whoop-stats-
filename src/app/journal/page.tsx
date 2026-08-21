"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, Check, ChevronLeft, ChevronRight, Coffee, HeartPulse, NotebookPen,
  Sparkles, TrendingDown, TrendingUp, Utensils,
} from "lucide-react";
import { Card, Chip, IconBadge, PageHeader, Section, SkeletonPage, Why } from "@/components/ui";
import { useHealth } from "@/lib/data/use-health";
import { useApp } from "@/lib/data/store";
import { addDays, cn, fmtDate, fmtNum, isoOf, relativeDay, todayISO } from "@/lib/format";
import { JournalEntry, JournalRatings } from "@/lib/types";
import type { ScoredDay } from "@/lib/scoring/engine";

interface TagImpact { tag: string; n: number; withAvg: number; delta: number; }

/** For a tag, how recovery on the days you logged it compares to days you didn't. */
function tagImpact(days: ScoredDay[], tag: string): TagImpact | null {
  const withTag: number[] = [];
  const without: number[] = [];
  for (const s of days) {
    if (s.recovery.available === false) continue;
    (s.day.journal?.tags.some((t) => t.label === tag) ? withTag : without).push(s.recovery.score);
  }
  if (withTag.length < 2) return null;
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const mw = mean(withTag);
  const mo = without.length ? mean(without) : mw;
  return { tag, n: withTag.length, withAvg: Math.round(mw), delta: Math.round(mw - mo) };
}

const RATING_KEYS: { key: keyof JournalRatings; label: string; color: string; invert?: boolean }[] = [
  { key: "mood", label: "Mood", color: "#13b57e" },
  { key: "stress", label: "Stress", color: "#ef5a45", invert: true },
  { key: "energy", label: "Energy", color: "#eb9d18" },
  { key: "focus", label: "Focus", color: "#2298cf" },
  { key: "sleepQuality", label: "Sleep quality", color: "#7b68ee" },
];

/** Word descriptor for a 1–10 rating (invert = higher is worse, e.g. stress). */
function ratingWord(v: number, invert = false): string {
  const level = v <= 3 ? "low" : v <= 6 ? "moderate" : "high";
  if (!invert) return level === "low" ? "low" : level === "moderate" ? "fair" : "great";
  return level; // stress reads literally: low / moderate / high
}

const TAG_GROUPS: { label: string; icon: React.ReactNode; color: string; tags: string[] }[] = [
  { label: "Intake", icon: <Coffee size={13} />, color: "#a98b3f", tags: ["Caffeine", "Alcohol", "Smoking", "Big meal", "Late meal"] },
  { label: "Movement", icon: <Activity size={13} />, color: "#13b57e", tags: ["Football", "Running", "Gym", "Walking", "Sauna"] },
  { label: "Life", icon: <NotebookPen size={13} />, color: "#2298cf", tags: ["Studying", "Social event", "Travel", "Work"] },
  { label: "Body", icon: <HeartPulse size={13} />, color: "#ef5a45", tags: ["Medication", "Sick"] },
];

const ACCENT = "#a98b3f";

const blankEntry = (date: string): JournalEntry => ({
  date,
  ratings: { mood: 5, stress: 5, energy: 5, focus: 5, sleepQuality: 5 },
  tags: [],
});

export default function JournalPage() {
  const data = useHealth();
  const saveJournal = useApp((s) => s.saveJournal);
  const journalMap = useApp((s) => s.journal);

  const [selected, setSelected] = useState(todayISO());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayISO()));
  const persisted = journalMap[selected];

  const [draft, setDraft] = useState<JournalEntry>(() => persisted ?? blankEntry(selected));
  const [savedJson, setSavedJson] = useState<string>(() => JSON.stringify(persisted ?? blankEntry(selected)));
  const [justSaved, setJustSaved] = useState(false);

  // When the selected date (or its stored entry) changes, load it — unless the
  // user has unsaved edits to the current draft.
  useEffect(() => {
    const target = journalMap[selected] ?? blankEntry(selected);
    const targetJson = JSON.stringify(target);
    if (JSON.stringify(draft) === savedJson || draft.date !== selected) {
      setDraft(target);
      setSavedJson(targetJson);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, journalMap]);

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  if (!data.hydrated) return <SkeletonPage />;

  const dirty = JSON.stringify(draft) !== savedJson;
  const setRating = (key: keyof JournalRatings, v: number) => setDraft((d) => ({ ...d, ratings: { ...d.ratings, [key]: v } }));
  const toggleTag = (label: string) =>
    setDraft((d) => ({
      ...d,
      tags: d.tags.some((t) => t.label === label) ? d.tags.filter((t) => t.label !== label) : [...d.tags, { label }],
    }));
  const save = () => {
    saveJournal(draft);
    setSavedJson(JSON.stringify(draft));
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
  };

  const journalInsights = data.insights.filter((i) => i.domain === "journal");
  const recentDates = Array.from({ length: 30 }, (_, i) => addDays(todayISO(), -i)).filter((d) => journalMap[d]);

  // Impact: recovery on days with each tag vs without.
  const selectedImpacts = draft.tags
    .map((t) => tagImpact(data.days, t.label))
    .filter((x): x is TagImpact => x !== null);
  const allTags = Array.from(new Set(Object.values(journalMap).flatMap((j) => j.tags.map((t) => t.label))));
  const overallImpacts = allTags
    .map((t) => tagImpact(data.days, t))
    .filter((x): x is TagImpact => x !== null)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const impacts = (selectedImpacts.length ? selectedImpacts : overallImpacts).slice(0, 6);

  return (
    <div className="animate-fadeUp">
      <PageHeader back title="Journal" sub="Log the life around the data — it becomes your personal experiment system." />

      {/* Week date strip */}
      <div className="mt-5 flex items-center gap-2">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/[0.08] text-ink-400 transition hover:bg-black/[0.04] hover:text-ink-100" aria-label="Previous week">
          <ChevronLeft size={16} />
        </button>
        <div className="grid flex-1 grid-cols-7 gap-1.5">
          {weekDates.map((d) => {
            const isSel = d === selected;
            const isToday = d === todayISO();
            const has = !!journalMap[d];
            const future = d > todayISO();
            return (
              <button
                key={d}
                disabled={future}
                onClick={() => setSelected(d)}
                className={cn(
                  "flex flex-col items-center rounded-xl border py-2 transition disabled:opacity-30",
                  isSel ? "border-transparent text-white shadow-lift" : "border-black/[0.06] text-ink-300 hover:bg-black/[0.03]"
                )}
                style={isSel ? { background: ACCENT } : undefined}
              >
                <span className={cn("text-[10px] font-medium uppercase", isSel ? "text-white/80" : "text-ink-500")}>{fmtDate(d, { weekday: "short" })}</span>
                <span className={cn("tabular mt-0.5 text-[15px] font-bold")} style={isToday && !isSel ? { color: ACCENT } : undefined}>{fmtDate(d, { day: "numeric" })}</span>
                <span className={cn("mt-1 h-1 w-1 rounded-full", has ? (isSel ? "bg-white" : "") : "bg-transparent")} style={has && !isSel ? { background: ACCENT } : undefined} />
              </button>
            );
          })}
        </div>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/[0.08] text-ink-400 transition hover:bg-black/[0.04] hover:text-ink-100" aria-label="Next week">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-5">
        {/* Editor */}
        <Section className="mt-6" title={relativeDay(selected)} sub={persisted ? "Editing your entry" : "Rate the day and tag what happened"} accent={ACCENT} icon={<NotebookPen size={15} />}>
          <Card>
            {/* Ratings with custom sliders */}
            <div className="space-y-5">
              {RATING_KEYS.map(({ key, label, color, invert }) => {
                // Fall back to a neutral 5 when a rating is missing — older entries
                // predate focus/sleepQuality, and an undefined value would produce a
                // NaN track %, leaving the slider with no track (just a floating thumb).
                const v = draft.ratings[key] ?? 5;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium text-ink-200">{label}</span>
                      <span className="flex items-baseline gap-1.5">
                        <span className="text-[11px] capitalize text-ink-400">{ratingWord(v, invert)}</span>
                        <span className="tabular inline-flex h-6 min-w-[2.1rem] items-center justify-center rounded-lg px-1.5 text-[13px] font-bold text-white" style={{ background: color }}>{v}</span>
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={v}
                      onChange={(e) => setRating(key, parseInt(e.target.value, 10))}
                      className="slider mt-2.5"
                      style={{ ["--pct" as string]: `${((v - 1) / 9) * 100}%`, ["--accent" as string]: color }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Tags grouped by category */}
            <div className="mt-6 border-t border-black/[0.06] pt-5">
              <div className="text-[13px] font-medium text-ink-200">Tags &amp; events</div>
              <div className="mt-3 space-y-3">
                {TAG_GROUPS.map((g) => (
                  <div key={g.label}>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500">
                      <span style={{ color: g.color }}>{g.icon}</span>
                      {g.label}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {g.tags.map((tag) => (
                        <Chip
                          key={tag}
                          label={tag}
                          color={g.color}
                          active={draft.tags.some((t) => t.label === tag)}
                          onClick={() => toggleTag(tag)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <textarea
                value={draft.note ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                placeholder="Anything worth remembering about this day…"
                rows={3}
                className="field w-full px-3.5 py-2.5 text-sm"
                style={{ ["--accent" as string]: ACCENT }}
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-3 border-t border-black/[0.06] pt-4">
              {justSaved && <span className="flex items-center gap-1 text-xs font-medium text-good"><Check size={13} /> Saved to your timeline</span>}
              <button
                onClick={save}
                disabled={!dirty}
                className="rounded-full px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-default disabled:opacity-40"
                style={{ background: ACCENT }}
              >
                {dirty ? "Save entry" : "Saved"}
              </button>
            </div>
          </Card>
        </Section>

        {/* Right column: recent entries + patterns */}
        <div className="mt-6 space-y-8 lg:mt-6">
          <Section className="mt-0" title="Recent entries" sub={recentDates.length ? `${recentDates.length} logged` : "nothing logged yet"} accent={ACCENT}>
            {recentDates.length ? (
              <div className="space-y-2.5">
                {recentDates.slice(0, 10).map((date) => {
                  const j = journalMap[date]!;
                  return (
                    <Card
                      key={date}
                      onClick={() => { setSelected(date); setWeekStart(startOfWeek(date)); }}
                      className={cn("card-interactive p-4", date === selected && "ring-1", date === selected && "ring-[#a98b3f]/50")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[13px] font-semibold text-ink-100">{relativeDay(date)}</span>
                        <div className="flex items-center gap-1.5">
                          {([["mood", "#13b57e"], ["energy", "#eb9d18"], ["stress", "#ef5a45"]] as const).map(([k, c]) => (
                            <span key={k} className="tabular inline-flex items-center gap-1 rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[10px] text-ink-400">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                              {j.ratings[k]}
                            </span>
                          ))}
                        </div>
                      </div>
                      {j.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {j.tags.map((t, i2) => (
                            <span key={i2} className="rounded-full bg-black/[0.05] px-2.5 py-0.5 text-[11px] text-ink-300">{t.label}{t.intensity ? ` ×${t.intensity}` : ""}</span>
                          ))}
                        </div>
                      )}
                      {j.note && <p className="mt-2 line-clamp-2 text-xs italic text-ink-400">“{j.note}”</p>}
                    </Card>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-black/[0.1] px-4 py-6 text-center text-xs text-ink-500">Your logged days will collect here.</p>
            )}
          </Section>

          {journalInsights.length > 0 && (
            <Section className="mt-0" title="Patterns from your logs" sub="Observed associations — not causation" accent="#7b68ee" icon={<Sparkles size={15} />}>
              <div className="space-y-3">
                {journalInsights.map((i) => (
                  <Card key={i.id} className="flex items-start gap-3 p-4">
                    <IconBadge color="#7b68ee" size={32}><Sparkles size={15} /></IconBadge>
                    <div>
                      <p className="text-sm font-medium text-ink-100">{i.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-ink-400">{i.detail}</p>
                      <p className="mt-1.5 text-[10px] text-ink-500">n = {fmtNum(i.n)} days · strength: {i.strength}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>

      <Section
        title="Journal impact"
        sub={selectedImpacts.length ? `How ${relativeDay(selected).toLowerCase()}'s tags line up with your recovery` : "How your tags line up with your recovery"}
        accent="#13b57e"
        icon={<Utensils size={15} />}
      >
        {impacts.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {impacts.map((im) => {
              const good = im.delta >= 0;
              const c = good ? "#13b57e" : "#ef5a45";
              const mag = Math.min(1, Math.abs(im.delta) / 12);
              return (
                <Card key={im.tag} className="p-4">
                  <div className="flex items-center gap-3">
                    <IconBadge color={c} size={34}>{good ? <TrendingUp size={16} /> : <TrendingDown size={16} />}</IconBadge>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-ink-100">{im.tag}</div>
                      <div className="text-[11px] text-ink-500">recovery averages <span className="tabular text-ink-300">{im.withAvg}%</span> · n = {im.n}</div>
                    </div>
                    <span className="tabular text-right text-lg font-bold" style={{ color: c }}>{good ? "+" : ""}{im.delta}</span>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.05]">
                    <div className="h-full rounded-full" style={{ width: `${mag * 100}%`, background: c, opacity: 0.85 }} />
                  </div>
                  <p className="mt-1.5 text-[10px] text-ink-500">vs days without this tag</p>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-5 text-center text-xs leading-relaxed text-ink-400">
            Log a tag on a few days and CURA will show how each one lines up with your recovery here. It needs at least
            two days with a tag to compare.
          </Card>
        )}
      </Section>

      <div className="mt-8">
        <Why summary="How does the journal power insights?">
          Every tag becomes a variable CURA can compare against your physiology — e.g. HRV, recovery and sleep on days
          after you smoked vs days you didn&apos;t, always with the sample size shown. Associations are reported
          observationally and never as proof of cause.
        </Why>
      </div>
    </div>
  );
}

function startOfWeek(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const day = (d.getDay() + 6) % 7; // Monday = 0
  const c = new Date(d);
  c.setDate(c.getDate() - day);
  return isoOf(c);
}
