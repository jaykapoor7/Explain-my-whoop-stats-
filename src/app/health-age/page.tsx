"use client";

import { useState } from "react";
import { Cake, Sparkles, TrendingDown } from "lucide-react";
import { Card, PageHeader, Section, SkeletonPage, Why } from "@/components/ui";
import { TrendArea } from "@/components/charts";
import { AgeSetter, REC, OLDER, YOUNGER } from "@/components/health-age";
import { RangeToggle } from "@/components/score-page";
import { useHealth } from "@/lib/data/use-health";
import { useApp } from "@/lib/data/store";
import { ageFromBirthYear, calcHealthAgeWeekly, healthAgeTrend } from "@/lib/scoring/health-age";

export default function HealthAgePage() {
  const data = useHealth();
  const birthYear = useApp((s) => s.settings.birthYear);
  const [range, setRange] = useState<30 | 90>(90);

  if (!data.hydrated) return <SkeletonPage />;

  const actualAge = ageFromBirthYear(birthYear);
  const r = calcHealthAgeWeekly(data.days, actualAge);
  const accent = r.deltaYears <= 0 ? YOUNGER : OLDER;

  const header = <PageHeader title="Health Age" sub="How old your body reads versus the calendar — and how to turn it back." />;

  // Not enough to show yet.
  if (!r.available) {
    return (
      <div className="animate-fadeUp">
        {header}
        <Card className="mt-5 p-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: `${YOUNGER}1f`, color: YOUNGER }}>
            {r.reason === "set-age" ? <Cake size={22} /> : <Sparkles size={22} />}
          </span>
          {r.reason === "set-age" ? (
            <>
              <h3 className="mt-4 font-display text-lg font-bold text-ink-50">Add your birth year</h3>
              <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-400">
                CURA estimates how old your body reads from your HRV, resting heart rate, sleep and activity — then shows
                the trend and what&apos;s moving it.
              </p>
              <div className="mt-5 flex justify-center"><AgeSetter /></div>
            </>
          ) : (
            <>
              <h3 className="mt-4 font-display text-lg font-bold text-ink-50">Not enough data yet</h3>
              <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-400">
                Health Age needs about a week of HRV and resting-heart-rate readings. Connect and sync your Fitbit and it
                will appear here.
              </p>
            </>
          )}
        </Card>
      </div>
    );
  }

  const trendAll = healthAgeTrend(data.days, actualAge);
  const trend = trendAll.slice(-range);
  const recs = r.factors.filter((f) => f.years > 0).sort((a, b) => b.years - a.years).slice(0, 4);
  // Keep the actual-age reference line inside the visible range.
  const vals = trend.map((t) => t.value);
  const lo = Math.floor(Math.min(...vals, r.actualAge)) - 1;
  const hi = Math.ceil(Math.max(...vals, r.actualAge)) + 1;

  return (
    <div className="animate-fadeUp">
      <PageHeader
        title="Health Age"
        sub="How old your body reads versus the calendar — and how to turn it back."
        right={<span className="tabular rounded-full px-3 py-1.5 text-sm font-semibold" style={{ background: `${accent}1f`, color: accent }}>{r.status}</span>}
      />

      {/* Hero */}
      <Card className="mt-5 overflow-hidden" style={{ background: `linear-gradient(135deg, ${accent}14, ${accent}05 45%, transparent)` }}>
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
          <div className="flex items-center gap-4">
            <span className="tabular font-display text-7xl font-bold leading-none" style={{ color: accent }}>{r.physioAge}</span>
            <div className="text-left">
              <div className="text-[11px] font-medium uppercase tracking-wide text-ink-500">Your body reads</div>
              <div className="text-sm text-ink-300">vs {r.actualAge} actual</div>
              <span className="tabular mt-2 inline-block rounded-xl px-3 py-1 text-sm font-semibold" style={{ background: `${accent}1f`, color: accent }}>
                {r.deltaYears === 0 ? "on pace" : `${Math.abs(r.deltaYears)} yr ${r.deltaYears < 0 ? "younger" : "older"}`}
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-center text-sm leading-relaxed text-ink-200 sm:text-left">{r.headline}</p>
            <p className="mt-1.5 text-center text-[11px] text-ink-500 sm:text-left">Refreshes every Sunday, so it&apos;s a steady weekly read — not a daily wobble.</p>
          </div>
        </div>
      </Card>

      {/* Trend */}
      {trend.length > 1 && (
        <Section title="Trend" sub={`Your estimated Health Age over time · dashed line is your actual age (${r.actualAge})`} action={<RangeToggle range={range} setRange={setRange} options={[30, 90]} />}>
          <Card>
            <TrendArea data={trend} color={accent} unit=" yr" name="Health Age" baseline={r.actualAge} domain={[lo, hi]} />
          </Card>
        </Section>
      )}

      {/* Recommendations */}
      {recs.length > 0 && (
        <Section title="Turn back the clock" sub="Where you'll get the most back, most easily">
          <div className="grid gap-3 sm:grid-cols-2">
            {recs.map((f) => (
              <Card key={f.label} className="flex items-start gap-3 p-4">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${OLDER}17`, color: OLDER }}>
                  <TrendingDown size={17} />
                </span>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-semibold text-ink-100">{f.label}</span>
                    <span className="tabular text-[11px] font-semibold" style={{ color: OLDER }}>+{Math.abs(Math.round(f.years * 10) / 10)} yr</span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-400">{REC[f.label] ?? "Small, consistent habits here read younger."}</p>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {/* Full factor breakdown */}
      <Section title="Every factor" sub="What's keeping you young and what's ageing you">
        <Card className="p-2">
          {r.factors.map((f) => {
            const good = f.years < 0;
            const c = good ? YOUNGER : OLDER;
            return (
              <div key={f.label} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-black/[0.02]">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c }} />
                <span className="shrink-0 text-[13px] font-medium text-ink-100">{f.label}</span>
                <span className="ml-auto hidden truncate text-[11px] text-ink-400 sm:block">{f.detail}</span>
                <span className="tabular w-16 shrink-0 text-right text-xs font-semibold" style={{ color: c }}>
                  {good ? "−" : "+"}{Math.abs(Math.round(f.years * 10) / 10)} yr
                </span>
              </div>
            );
          })}
        </Card>
      </Section>

      <div className="mt-6">
        <Why summary="How is Health Age calculated?">
          It reads your last ~4 weeks across nine markers — HRV level and its night-to-night stability, resting heart
          rate, sleep duration, efficiency and consistency, daily steps, how often you train, and your average recovery
          — and compares each against rough age-expected values, nudging your calendar age up or down. Higher, steadier
          HRV, a low resting HR, consistent quality sleep and regular training read younger; erratic HRV, short or
          irregular sleep and low activity read older. This is an estimate for motivation, not a validated clinical
          measure — and never medical advice.
        </Why>
      </div>
    </div>
  );
}
