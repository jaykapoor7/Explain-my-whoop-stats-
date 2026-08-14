"use client";

import { useState } from "react";
import { Cake, ChevronDown, Sparkles, TrendingDown } from "lucide-react";
import { Card, Why } from "@/components/ui";
import { useHealth } from "@/lib/data/use-health";
import { useApp } from "@/lib/data/store";
import { calcHealthAge, ageFromBirthYear } from "@/lib/scoring/health-age";

const YOUNGER = "#13b57e";
const OLDER = "#eb9d18";

/** Specific, doable ways to bring each ageing factor back down. */
const REC: Record<string, string> = {
  "HRV": "Support HRV with consistent sleep, hydration and easy aerobic days.",
  "HRV stability": "Keep bed and wake times steady — regular nights calm HRV swings.",
  "Resting heart rate": "Regular zone-2 cardio gradually lowers your resting heart rate.",
  "Sleep duration": "Aim for 7.5–8h a night and protect a consistent bedtime.",
  "Sleep efficiency": "Wind down before bed; limit late caffeine and screens to sleep more solidly.",
  "Sleep consistency": "Hold your bed and wake times within ~30 minutes day to day.",
  "Daily activity": "Build a 7–10k step habit — everyday movement reads younger.",
  "Structured training": "Train 3–4× a week; even short sessions count.",
  "Recovery capacity": "Ease your training load and improve sleep to lift recovery.",
};

function AgeSetter() {
  const setSettings = useApp((s) => s.setSettings);
  const [year, setYear] = useState("");
  const thisYear = new Date().getFullYear();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="number"
        value={year}
        onChange={(e) => setYear(e.target.value)}
        placeholder="Birth year"
        className="tabular h-9 w-32 rounded-lg border border-black/12 bg-ink-875 px-3 text-sm text-ink-100 outline-none focus:border-black/25"
      />
      <button
        onClick={() => {
          const y = parseInt(year, 10);
          if (y >= thisYear - 100 && y <= thisYear - 13) setSettings({ birthYear: y });
        }}
        className="rounded-full px-4 py-2 text-xs font-semibold text-[#241f18]"
        style={{ background: YOUNGER }}
      >
        Save
      </button>
    </div>
  );
}

export function HealthAgeCard() {
  const data = useHealth();
  const birthYear = useApp((s) => s.settings.birthYear);
  const actualAge = ageFromBirthYear(birthYear);
  const r = calcHealthAge(data.days, actualAge);

  const accent = r.deltaYears <= 0 ? YOUNGER : OLDER;

  return (
    <Card className="overflow-hidden p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${accent}1f`, color: accent }}>
          <Sparkles size={14} />
        </span>
        <span className="text-[13px] font-semibold text-ink-100">Health Age</span>
        {r.available && (
          <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${accent}1f`, color: accent }}>
            {r.status}
          </span>
        )}
      </div>

      {!r.available ? (
        <div className="mt-3">
          {r.reason === "set-age" ? (
            <>
              <p className="flex items-center gap-1.5 text-xs leading-relaxed text-ink-400">
                <Cake size={13} /> Tell me your birth year and I&apos;ll estimate how old your body reads from your HRV,
                resting heart rate, sleep and activity — the way WHOOP Age works.
              </p>
              <div className="mt-3">
                <AgeSetter />
              </div>
            </>
          ) : (
            <p className="text-xs leading-relaxed text-ink-400">
              Not enough synced data yet — Health Age needs about a week of HRV and resting-heart-rate readings. Connect
              and sync your Fitbit, and it will appear here.
            </p>
          )}
        </div>
      ) : (
        <HealthAgeBody r={r} accent={accent} />
      )}
    </Card>
  );
}

function HealthAgeBody({ r, accent }: { r: ReturnType<typeof calcHealthAge>; accent: string }) {
  const [open, setOpen] = useState(false);
  const recs = r.factors.filter((f) => f.years > 0).sort((a, b) => b.years - a.years).slice(0, 3);

  return (
    <>
      {/* Headline panel */}
      <div className="mt-4 flex items-center gap-4 rounded-2xl p-4" style={{ background: `linear-gradient(135deg, ${accent}14, ${accent}06)` }}>
        <div className="flex items-baseline gap-1">
          <span className="tabular font-display text-5xl font-bold leading-none" style={{ color: accent }}>{r.physioAge}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wide text-ink-500">Your body reads</div>
          <div className="text-sm text-ink-300">vs {r.actualAge} actual age</div>
        </div>
        <span className="tabular shrink-0 rounded-xl px-3 py-1.5 text-sm font-semibold" style={{ background: `${accent}1f`, color: accent }}>
          {r.deltaYears === 0 ? "on pace" : `${Math.abs(r.deltaYears)} yr ${r.deltaYears < 0 ? "younger" : "older"}`}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink-200">{r.headline}</p>

      {/* Recommendations */}
      {recs.length > 0 && (
        <div className="mt-4 rounded-2xl border border-black/[0.05] bg-black/[0.015] p-4">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-100">
            <TrendingDown size={14} style={{ color: YOUNGER }} /> Turn back the clock
          </div>
          <ul className="mt-2.5 space-y-2">
            {recs.map((f) => (
              <li key={f.label} className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: OLDER }} />
                <span className="text-[12.5px] leading-relaxed text-ink-300">
                  <span className="font-medium text-ink-100">{f.label}</span> — {REC[f.label] ?? "small, consistent habits here read younger."}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Expandable factor breakdown */}
      {r.factors.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded-xl border border-black/[0.06] bg-black/[0.02] px-3.5 py-2.5 text-[12.5px] font-medium text-ink-200 transition-colors hover:bg-black/[0.035]"
          >
            <span className="flex-1 text-left">{open ? "Hide" : "See"} the {r.factors.length} factors behind it</span>
            <ChevronDown size={15} className={`text-ink-400 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <div className="mt-2 space-y-1 rounded-xl border border-black/[0.05] bg-black/[0.01] p-2">
              {r.factors.map((f) => {
                const good = f.years < 0;
                const c = good ? YOUNGER : OLDER;
                return (
                  <div key={f.label} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c }} />
                    <span className="shrink-0 text-[13px] text-ink-100">{f.label}</span>
                    <span className="ml-auto hidden truncate text-[11px] text-ink-400 sm:block">{f.detail}</span>
                    <span className="tabular w-16 shrink-0 text-right text-xs font-semibold" style={{ color: c }}>
                      {good ? "−" : "+"}{Math.abs(Math.round(f.years * 10) / 10)} yr
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Why summary="How is Health Age calculated?">
        It reads your last ~4 weeks across nine markers — HRV level and its night-to-night stability, resting heart
        rate, sleep duration, efficiency and consistency, daily steps, how often you train, and your average recovery
        — and compares each against rough age-expected values, nudging your calendar age up or down. Higher, steadier
        HRV, a low resting HR, consistent quality sleep and regular training read younger; erratic HRV, short or
        irregular sleep and low activity read older. This is an estimate for motivation, not a validated clinical
        measure — and never medical advice.
      </Why>
    </>
  );
}
