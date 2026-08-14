"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Cake, Sparkles } from "lucide-react";
import { Card } from "@/components/ui";
import { useHealth } from "@/lib/data/use-health";
import { useApp } from "@/lib/data/store";
import { calcHealthAgeWeekly, ageFromBirthYear } from "@/lib/scoring/health-age";

export const YOUNGER = "#13b57e";
export const OLDER = "#eb9d18";

/** Specific, doable ways to bring each ageing factor back down. */
export const REC: Record<string, string> = {
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

export function AgeSetter() {
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
        className="tabular h-10 w-36 rounded-xl border border-black/10 bg-black/[0.02] px-3.5 text-sm text-ink-100 outline-none focus:border-black/25"
      />
      <button
        onClick={() => { const y = parseInt(year, 10); if (y >= thisYear - 100 && y <= thisYear - 13) setSettings({ birthYear: y }); }}
        className="rounded-full px-4 py-2.5 text-xs font-semibold text-white"
        style={{ background: YOUNGER }}
      >
        Save
      </button>
    </div>
  );
}

/** One-line Health Age strip for the Today page — it only updates weekly, so it
 * doesn't need a big daily card. Taps through to the full page. */
export function HealthAgeStrip() {
  const data = useHealth();
  const birthYear = useApp((s) => s.settings.birthYear);
  const actualAge = ageFromBirthYear(birthYear);
  const r = calcHealthAgeWeekly(data.days, actualAge);

  if (!r.available) {
    if (r.reason === "set-age") {
      return (
        <Link href="/health-age" className="group block">
          <Card className="flex items-center gap-3 p-4 transition-all group-hover:-translate-y-0.5 group-hover:shadow-lift">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${YOUNGER}1f`, color: YOUNGER }}><Cake size={15} /></span>
            <span className="min-w-0 flex-1 text-[13px] text-ink-300">Add your birth year to see your Health Age</span>
            <ArrowRight size={15} className="shrink-0 text-ink-400 transition-transform group-hover:translate-x-0.5" />
          </Card>
        </Link>
      );
    }
    return null;
  }

  const accent = r.deltaYears <= 0 ? YOUNGER : OLDER;
  return (
    <Link href="/health-age" className="group block">
      <Card className="flex items-center gap-3.5 p-4 transition-all group-hover:-translate-y-0.5 group-hover:shadow-lift">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${accent}1f`, color: accent }}><Sparkles size={16} /></span>
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-ink-500">Health Age</span>
          <span className="tabular font-display text-2xl font-bold leading-none" style={{ color: accent }}>{r.physioAge}</span>
          <span className="text-xs text-ink-400">vs {r.actualAge}</span>
        </div>
        <span className="tabular shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: `${accent}1f`, color: accent }}>
          {r.deltaYears === 0 ? "on pace" : `${Math.abs(r.deltaYears)} yr ${r.deltaYears < 0 ? "younger" : "older"}`}
        </span>
        <ArrowRight size={15} className="shrink-0 text-ink-400 transition-transform group-hover:translate-x-0.5" />
      </Card>
    </Link>
  );
}

/** Compact Health Age summary for the Today page — taps through to the full page. */
export function HealthAgeCard() {
  const data = useHealth();
  const birthYear = useApp((s) => s.settings.birthYear);
  const actualAge = ageFromBirthYear(birthYear);
  const r = calcHealthAgeWeekly(data.days, actualAge);
  const accent = r.deltaYears <= 0 ? YOUNGER : OLDER;

  if (!r.available) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${YOUNGER}1f`, color: YOUNGER }}>
            <Sparkles size={14} />
          </span>
          <span className="text-[13px] font-semibold text-ink-100">Health Age</span>
        </div>
        {r.reason === "set-age" ? (
          <div className="mt-3">
            <p className="flex items-start gap-1.5 text-xs leading-relaxed text-ink-400">
              <Cake size={13} className="mt-0.5 shrink-0" /> Add your birth year and CURA estimates how old your body reads from your HRV, resting heart rate, sleep and activity.
            </p>
            <div className="mt-3"><AgeSetter /></div>
          </div>
        ) : (
          <p className="mt-3 text-xs leading-relaxed text-ink-400">
            Not enough synced data yet — Health Age needs about a week of HRV and resting-heart-rate readings.
          </p>
        )}
      </Card>
    );
  }

  return (
    <Link href="/health-age" className="group block">
      <Card className="p-5 transition-all group-hover:-translate-y-0.5 group-hover:shadow-lift">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${accent}1f`, color: accent }}>
            <Sparkles size={14} />
          </span>
          <span className="text-[13px] font-semibold text-ink-100">Health Age</span>
          <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${accent}1f`, color: accent }}>{r.status}</span>
        </div>

        <div className="mt-4 flex items-center gap-4 rounded-2xl p-4" style={{ background: `linear-gradient(135deg, ${accent}14, ${accent}06)` }}>
          <span className="tabular font-display text-5xl font-bold leading-none" style={{ color: accent }}>{r.physioAge}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium uppercase tracking-wide text-ink-500">Your body reads</div>
            <div className="text-sm text-ink-300">vs {r.actualAge} actual age</div>
          </div>
          <span className="tabular shrink-0 rounded-xl px-3 py-1.5 text-sm font-semibold" style={{ background: `${accent}1f`, color: accent }}>
            {r.deltaYears === 0 ? "on pace" : `${Math.abs(r.deltaYears)} yr ${r.deltaYears < 0 ? "younger" : "older"}`}
          </span>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-ink-200">{r.headline}</p>
        <div className="mt-3 flex items-center gap-1 text-xs font-medium" style={{ color: accent }}>
          View trends, factors &amp; tips <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </div>
      </Card>
    </Link>
  );
}
