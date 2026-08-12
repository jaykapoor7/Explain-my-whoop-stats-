"use client";

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Card, PageHeader, Section, SkeletonPage, Why } from "@/components/ui";
import { useHealth } from "@/lib/data/use-health";
import { useApp } from "@/lib/data/store";
import { addDays, cn, fmtNum, relativeDay, todayISO } from "@/lib/format";
import { JournalEntry, JournalRatings } from "@/lib/types";

const RATING_KEYS: { key: keyof JournalRatings; label: string }[] = [
  { key: "mood", label: "Mood" },
  { key: "stress", label: "Stress" },
  { key: "energy", label: "Energy" },
  { key: "focus", label: "Focus" },
  { key: "sleepQuality", label: "Sleep quality" },
];

const QUICK_TAGS = [
  "Smoking", "Caffeine", "Alcohol", "Football", "Running", "Gym", "Walking",
  "Studying", "Social event", "Travel", "Big meal", "Medication",
];

export default function JournalPage() {
  const data = useHealth();
  const saveJournal = useApp((s) => s.saveJournal);
  const journalMap = useApp((s) => s.journal);
  const [draftNote, setDraftNote] = useState<string | null>(null);

  const entry = data.todayJournal;

  const draft = useMemo<JournalEntry>(
    () =>
      entry ?? {
        date: todayISO(),
        ratings: { mood: 5, stress: 5, energy: 5, focus: 5, sleepQuality: 5 },
        tags: [],
      },
    [entry]
  );

  if (!data.hydrated) return <SkeletonPage />;

  const setRating = (key: keyof JournalRatings, v: number) =>
    saveJournal({ ...draft, note: draftNote ?? draft.note, ratings: { ...draft.ratings, [key]: v } });

  const toggleTag = (label: string) => {
    const has = draft.tags.some((t) => t.label === label);
    saveJournal({
      ...draft,
      note: draftNote ?? draft.note,
      tags: has ? draft.tags.filter((t) => t.label !== label) : [...draft.tags, { label }],
    });
  };

  const journalInsights = data.insights.filter((i) => i.domain === "journal");

  return (
    <div className="animate-fadeUp">
      <PageHeader title="Journal" sub="Log the life around the data — it becomes your personal experiment system." />

      <Section title={relativeDay(todayISO())} sub="Rate the day and tag what happened">
        <Card>
          <div className="space-y-4">
            {RATING_KEYS.map(({ key, label }) => (
              <div key={key}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-medium text-ink-200">{label}</span>
                  <span className="tabular text-ink-400">
                    <span className="text-ink-100">{draft.ratings[key]}</span> / 10
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={draft.ratings[key]}
                  onChange={(e) => setRating(key, parseInt(e.target.value, 10))}
                  className="mt-1.5 w-full accent-[#c9b98a]"
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
                      on ? "bg-[#c9b98a] text-[#241f18]" : "border border-black/12 text-ink-300 hover:bg-black/[0.06]"
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
              value={draftNote ?? draft.note ?? ""}
              onChange={(e) => setDraftNote(e.target.value)}
              onBlur={() => draftNote !== null && saveJournal({ ...draft, note: draftNote })}
              placeholder="Anything worth remembering about today…"
              rows={2}
              className="w-full rounded-xl border border-black/10 bg-ink-875 px-3.5 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-black/25"
            />
          </div>
        </Card>
      </Section>

      {journalInsights.length > 0 && (
        <Section title="Patterns from your logs" sub="Observed associations — not causation">
          <div className="space-y-3">
            {journalInsights.map((i) => (
              <Card key={i.id} className="flex items-start gap-3 p-4">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/[0.06] text-ink-200">
                  <Sparkles size={15} />
                </span>
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

      <Section title="Recent entries">
        <div className="space-y-2.5">
          {Array.from({ length: 7 }, (_, i) => addDays(todayISO(), -i))
            .map((date) => {
              const j = journalMap[date];
              if (!j) return null;
              return (
                <Card key={date} className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-ink-100">{relativeDay(date)}</span>
                    <span className="tabular text-xs text-ink-400">
                      mood {j.ratings.mood} · stress {j.ratings.stress} · energy {j.ratings.energy}
                    </span>
                  </div>
                  {j.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {j.tags.map((t, i2) => (
                        <span key={i2} className="rounded-full bg-black/[0.06] px-2.5 py-0.5 text-[11px] text-ink-300">
                          {t.label}
                          {t.intensity ? ` ×${t.intensity}` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                  {j.note && <p className="mt-2 text-xs italic text-ink-400">“{j.note}”</p>}
                </Card>
              );
            })}
        </div>
      </Section>

      <div className="mt-6">
        <Why summary="How does the journal power insights?">
          Every tag becomes a variable the pattern engine can compare against your physiology — e.g. HRV, recovery and
          sleep on days after you smoked vs days you didn&apos;t, always with the sample size shown.
          Associations are reported observationally and never as proof of cause.
        </Why>
      </div>
    </div>
  );
}
