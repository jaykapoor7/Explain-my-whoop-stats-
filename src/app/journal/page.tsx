"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Card, PageHeader, Section, SkeletonPage, Why } from "@/components/ui";
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

const RATING_KEYS: { key: keyof JournalRatings; label: string; color: string }[] = [
  { key: "mood", label: "Mood", color: "#13b57e" },
  { key: "stress", label: "Stress", color: "#ef5a45" },
  { key: "energy", label: "Energy", color: "#eb9d18" },
  { key: "focus", label: "Focus", color: "#2298cf" },
  { key: "sleepQuality", label: "Sleep quality", color: "#7b68ee" },
];

const QUICK_TAGS = [
  "Smoking", "Caffeine", "Alcohol", "Football", "Running", "Gym", "Walking",
  "Studying", "Social event", "Travel", "Big meal", "Late meal", "Medication", "Sick", "Sauna",
];

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

  // Impact: recovery on days with each tag vs without. Prefer the selected
  // day's tags; otherwise surface the strongest patterns across all your tags.
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
      <PageHeader title="Journal" sub="Log the life around the data — it becomes your personal experiment system." />

      {/* Week date strip */}
      <div className="mt-5 flex items-center gap-2">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/[0.08] text-ink-400 hover:text-ink-100" aria-label="Previous week">
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
                  isSel ? "border-transparent bg-[#a98b3f] text-white shadow-lift" : "border-black/[0.06] text-ink-300 hover:bg-black/[0.03]"
                )}
              >
                <span className={cn("text-[10px] font-medium uppercase", isSel ? "text-white/80" : "text-ink-500")}>{fmtDate(d, { weekday: "short" })}</span>
                <span className={cn("tabular mt-0.5 text-[15px] font-bold", isToday && !isSel && "text-[#a98b3f]")}>{fmtDate(d, { day: "numeric" })}</span>
                <span className={cn("mt-1 h-1 w-1 rounded-full", has ? (isSel ? "bg-white" : "bg-[#a98b3f]") : "bg-transparent")} />
              </button>
            );
          })}
        </div>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/[0.08] text-ink-400 hover:text-ink-100" aria-label="Next week">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-5">
        {/* Editor */}
        <Section className="mt-6" title={relativeDay(selected)} sub={persisted ? "Editing your entry" : "Rate the day and tag what happened"}>
          <Card>
            <div className="space-y-4">
              {RATING_KEYS.map(({ key, label, color }) => (
                <div key={key}>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium text-ink-200">{label}</span>
                    <span className="tabular text-ink-400"><span className="font-semibold" style={{ color }}>{draft.ratings[key]}</span> / 10</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={draft.ratings[key]}
                    onChange={(e) => setRating(key, parseInt(e.target.value, 10))}
                    className="mt-1.5 w-full"
                    style={{ accentColor: color }}
                  />
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-black/[0.06] pt-4">
              <div className="text-xs font-medium text-ink-200">Tags & events</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {QUICK_TAGS.map((tag) => {
                  const on = draft.tags.some((t) => t.label === tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-medium transition",
                        on ? "bg-[#a98b3f] text-white" : "border border-black/12 text-ink-300 hover:bg-black/[0.06]"
                      )}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4">
              <textarea
                value={draft.note ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                placeholder="Anything worth remembering about this day…"
                rows={3}
                className="w-full rounded-xl border border-black/10 bg-ink-875 px-3.5 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-black/25"
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-3 border-t border-black/[0.06] pt-4">
              {justSaved && <span className="flex items-center gap-1 text-xs font-medium text-good"><Check size={13} /> Saved</span>}
              <button
                onClick={save}
                disabled={!dirty}
                className="rounded-full px-5 py-2 text-xs font-semibold text-white transition disabled:cursor-default disabled:opacity-40"
                style={{ background: "#a98b3f" }}
              >
                {dirty ? "Save entry" : "Saved"}
              </button>
            </div>
          </Card>
        </Section>

        {/* Right column: recent entries + patterns */}
        <div className="mt-6 space-y-8 lg:mt-6">
          <Section className="mt-0" title="Recent entries" sub={recentDates.length ? `${recentDates.length} logged` : "nothing logged yet"}>
            {recentDates.length ? (
              <div className="space-y-2.5">
                {recentDates.slice(0, 10).map((date) => {
                  const j = journalMap[date]!;
                  return (
                    <Card
                      key={date}
                      onClick={() => { setSelected(date); setWeekStart(startOfWeek(date)); }}
                      className={cn("cursor-pointer p-4 transition hover:-translate-y-0.5 hover:shadow-lift", date === selected && "ring-1 ring-[#a98b3f]/50")}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold text-ink-100">{relativeDay(date)}</span>
                        <span className="tabular text-xs text-ink-400">mood {j.ratings.mood} · stress {j.ratings.stress} · energy {j.ratings.energy}</span>
                      </div>
                      {j.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {j.tags.map((t, i2) => (
                            <span key={i2} className="rounded-full bg-black/[0.06] px-2.5 py-0.5 text-[11px] text-ink-300">{t.label}{t.intensity ? ` ×${t.intensity}` : ""}</span>
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
            <Section className="mt-0" title="Patterns from your logs" sub="Observed associations — not causation">
              <div className="space-y-3">
                {journalInsights.map((i) => (
                  <Card key={i.id} className="flex items-start gap-3 p-4">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/[0.06] text-ink-200"><Sparkles size={15} /></span>
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
      >
        {impacts.length ? (
          <Card className="divide-y divide-black/[0.05] p-0">
            {impacts.map((im) => {
              const good = im.delta >= 0;
              const c = good ? "#13b57e" : "#ef5a45";
              return (
                <div key={im.tag} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${c}1f`, color: c }}>
                    {good ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink-100">{im.tag}</div>
                    <div className="text-[11px] text-ink-500">
                      recovery averages <span className="tabular text-ink-300">{im.withAvg}%</span> on these days · n = {im.n}
                    </div>
                  </div>
                  <span className="tabular text-sm font-semibold" style={{ color: c }}>
                    {good ? "+" : ""}{im.delta}
                    <span className="ml-0.5 text-[10px] font-normal text-ink-500">vs other days</span>
                  </span>
                </div>
              );
            })}
          </Card>
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
