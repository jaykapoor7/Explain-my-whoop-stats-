"use client";

import Link from "next/link";
import { ScoreRing, SkeletonPage } from "@/components/ui";
import { useHealth } from "@/lib/data/use-health";
import { DOMAIN_COLOR, fmtDuration, fmtNum } from "@/lib/format";

/**
 * Glanceable widget view — designed for a quick look from your phone's home
 * screen (install the app via Share → Add to Home Screen). True iOS
 * lock-screen widgets require a native companion app (WidgetKit) — planned.
 */
export default function WidgetPage() {
  const data = useHealth();
  if (!data.hydrated) return <SkeletonPage />;
  const t = data.today;

  return (
    <div className="mx-auto max-w-sm animate-fadeUp pt-2">
      {t ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Energy", score: t.energy, color: DOMAIN_COLOR.energy },
              { label: "Recovery", score: t.recovery, color: DOMAIN_COLOR.recovery },
              { label: "Sleep", score: t.sleep, color: DOMAIN_COLOR.sleep },
              { label: "Strain", score: t.strain, color: DOMAIN_COLOR.strain },
            ].map((x) => (
              <div key={x.label} className="card flex flex-col items-center gap-1 py-4">
                <ScoreRing score={x.score.score} scale={x.score.scale} color={x.color} size={84} label={x.label} />
                <span className="text-[10px] text-ink-400">{x.score.status}</span>
              </div>
            ))}
          </div>
          <div className="card mt-3 flex items-center justify-between px-4 py-3 text-xs text-ink-300">
            <span>{fmtNum(t.day.steps)} steps</span>
            <span>{fmtDuration(t.day.sleep.asleepMin)} sleep</span>
            <span>{fmtNum(data.todayTotals.kcal)} kcal in</span>
          </div>
        </>
      ) : (
        <div className="card p-5 text-center text-xs text-ink-400">
          No data yet — connect your Fitbit in <Link href="/settings" className="text-recovery">Settings</Link>.
        </div>
      )}
      <p className="mt-4 text-center text-[10px] leading-relaxed text-ink-500">
        Tip: open this page and use Share → “Add to Home Screen” on iPhone for one-tap access.
        Native lock-screen widgets need a companion iOS app — on the roadmap.
      </p>
    </div>
  );
}
