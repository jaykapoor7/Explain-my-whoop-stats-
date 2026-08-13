"use client";

import { useState } from "react";
import { Cake, Sparkles } from "lucide-react";
import { Card, Why } from "@/components/ui";
import { useHealth } from "@/lib/data/use-health";
import { useApp } from "@/lib/data/store";
import { calcHealthAge, ageFromBirthYear } from "@/lib/scoring/health-age";

const YOUNGER = "#34e0a1";
const OLDER = "#ffc24b";

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
        <>
          <div className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-2">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-ink-500">Your body reads</div>
              <div className="flex items-baseline gap-2">
                <span className="tabular text-4xl font-bold" style={{ color: accent }}>{r.physioAge}</span>
                <span className="text-sm text-ink-400">vs {r.actualAge} actual</span>
              </div>
            </div>
            <div className="tabular rounded-xl px-3 py-1.5 text-sm font-semibold" style={{ background: `${accent}1a`, color: accent }}>
              {r.deltaYears === 0 ? "on pace" : `${Math.abs(r.deltaYears)} yr ${r.deltaYears < 0 ? "younger" : "older"}`}
            </div>
          </div>
          <p className="mt-2.5 text-sm leading-relaxed text-ink-200">{r.headline}</p>

          {r.factors.length > 0 && (
            <div className="mt-4 space-y-2">
              {r.factors.map((f) => {
                const good = f.years < 0;
                const c = good ? YOUNGER : OLDER;
                return (
                  <div key={f.label} className="flex items-center gap-3">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c }} />
                    <span className="text-[13px] text-ink-100">{f.label}</span>
                    <span className="ml-auto text-[11px] text-ink-400">{f.detail}</span>
                    <span className="tabular w-24 text-right text-xs font-semibold" style={{ color: c }}>
                      {good ? "−" : "+"}{Math.abs(Math.round(f.years * 10) / 10)} yr
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <Why summary="How is Health Age calculated?">
            It reads your last ~4 weeks across nine markers — HRV level and its night-to-night stability, resting heart
            rate, sleep duration, efficiency and consistency, daily steps, how often you train, and your average recovery
            — and compares each against rough age-expected values, nudging your calendar age up or down. Higher, steadier
            HRV, a low resting HR, consistent quality sleep and regular training read younger; erratic HRV, short or
            irregular sleep and low activity read older. This is a deterministic estimate for motivation, not a validated
            clinical measure — and never medical advice.
          </Why>
        </>
      )}
    </Card>
  );
}
