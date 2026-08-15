"use client";

import { ReactNode, useState } from "react";
import { Activity, CalendarRange, ChevronDown, Info, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui";
import type { AnalyticsInsight, DailyState, Evidence, HealthTrajectory, PersonalHealthModel, WeeklyDigest } from "@/lib/analytics";
import { cn } from "@/lib/format";

/**
 * UI for the personal-baseline intelligence engine: a cold-start learning
 * banner, the context-aware daily state with its evidence, and the ranked,
 * explainable insights. Every claim can be expanded to "why did CURA say this?".
 */

type Conf = "high" | "moderate" | "low" | "insufficient";
const CONF_STYLE: Record<Conf, string> = {
  high: "bg-good/15 text-good",
  moderate: "bg-warn/15 text-warn",
  low: "bg-black/[0.07] text-ink-300",
  insufficient: "bg-black/[0.07] text-ink-300",
};

function ConfPill({ c }: { c: Conf }) {
  return <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", CONF_STYLE[c])}>{c === "insufficient" ? "learning" : c}</span>;
}

/** A single baseline comparison, coloured by whether it's better/worse for you. */
function EvidenceRow({ e }: { e: Evidence }) {
  const tone = e.z <= -0.75 ? "text-bad" : e.z >= 0.75 ? "text-good" : "text-ink-300";
  const dot = e.z <= -0.75 ? "bg-bad" : e.z >= 0.75 ? "bg-good" : "bg-ink-400";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
      <span className="text-ink-200">{e.text}</span>
      <span className={cn("ml-auto tabular text-[11px]", tone)}>{e.z > 0 ? "+" : ""}{e.z.toFixed(1)}σ</span>
    </div>
  );
}

function Expand({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2.5 border-t border-black/[0.05] pt-2.5">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-1.5 text-[11px] font-medium text-ink-400 hover:text-ink-200">
        <Info size={12} /> {label}
        <ChevronDown size={12} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="mt-2 space-y-1.5">{children}</div>}
    </div>
  );
}

/** Cold-start / learning banner — shown until the model is on solid footing. */
export function StageBanner({ model }: { model: PersonalHealthModel }) {
  if (model.stage === "high-confidence" || model.stage === "personalized") return null;
  const brand = "#7b5cf0";
  return (
    <Card className="mt-4 flex items-start gap-3 p-4" style={{ borderColor: `${brand}33`, background: `${brand}0d` }}>
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${brand}26`, color: brand }}><Sparkles size={15} /></span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink-100">CURA is learning your baseline</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-400">{model.stageMessage}</p>
      </div>
    </Card>
  );
}

const STATE_COLOR = (label: string): string =>
  label === "Primed" ? "#38d39f" : label === "Low recovery" ? "#f6796b" : label === "Moderate" ? "#f6b83b" : label === "Elevated load" ? "#ff7a5c" : "#8b8cff";

function TrajectoryLine({ t }: { t: HealthTrajectory }) {
  if (t.direction === "uncertain" || t.score == null) return null;
  const up = t.direction === "improving";
  const Icon = up ? TrendingUp : t.direction === "declining" ? TrendingDown : Activity;
  const tone = up ? "text-good" : t.direction === "declining" ? "text-bad" : "text-ink-300";
  return (
    <div className="mt-2.5 flex items-center gap-1.5 border-t border-black/[0.05] pt-2.5 text-[11px]">
      <Icon size={13} className={tone} />
      <span className="text-ink-400">Overall trajectory: <span className={cn("font-medium", tone)}>{t.direction}</span> over recent weeks</span>
    </div>
  );
}

/** The context-aware daily state: a headline inferred from several signals, its
 * confidence, and the baseline comparisons that back it. */
export function DailyStateCard({ model }: { model: PersonalHealthModel }) {
  const st: DailyState = model.state;
  if (st.confidence === "insufficient") return null; // nothing honest to say yet
  const color = STATE_COLOR(st.label);
  const worst = st.evidence.filter((e) => e.z <= -0.75);
  const best = st.evidence.filter((e) => e.z >= 0.75);
  const lead = (worst.length >= best.length ? worst : best).slice(0, 4);

  return (
    <Card className="mt-4 p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${color}22`, color }}><Activity size={15} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wide text-ink-400">Today’s state · vs your baseline</div>
          <div className="text-[15px] font-semibold text-ink-50">{st.label}</div>
        </div>
        <ConfPill c={st.confidence} />
      </div>

      {lead.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {lead.map((e) => <EvidenceRow key={e.metric} e={e} />)}
        </div>
      )}

      <TrajectoryLine t={model.trajectory} />

      {st.evidence.length > lead.length && (
        <Expand label="Why this state">
          {st.evidence.map((e) => <EvidenceRow key={e.metric} e={e} />)}
        </Expand>
      )}
    </Card>
  );
}

/** One-line version of the daily state, for sitting above the score rings on
 * Today. Same evidence, expandable, minimal height. */
export function DailyStateStrip({ model }: { model: PersonalHealthModel }) {
  const st: DailyState = model.state;
  if (st.confidence === "insufficient") return null;
  const color = STATE_COLOR(st.label);
  const worst = st.evidence.filter((e) => e.z <= -0.75);
  const best = st.evidence.filter((e) => e.z >= 0.75);
  const lead = worst.length >= best.length ? worst : best;
  const summary = lead.slice(0, 2).map((e) => e.text).join(", ") || "in line with your baseline";
  const t = model.trajectory;
  const trajTone = t.direction === "improving" ? "text-good" : t.direction === "declining" ? "text-bad" : "text-ink-400";
  const TrajIcon = t.direction === "improving" ? TrendingUp : t.direction === "declining" ? TrendingDown : Activity;

  return (
    <Card className="mt-4 p-3.5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${color}22`, color }}><Activity size={15} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[13px] font-semibold text-ink-50">{st.label}</span>
            <span className="text-[11px] text-ink-400">{summary}</span>
          </div>
        </div>
        {t.direction !== "uncertain" && t.score != null && (
          <span className={cn("hidden items-center gap-1 text-[11px] font-medium sm:flex", trajTone)}><TrajIcon size={12} /> {t.direction}</span>
        )}
        <ConfPill c={st.confidence} />
      </div>
      {st.evidence.length > 0 && (
        <Expand label="Why this state">
          {st.evidence.map((e) => <EvidenceRow key={e.metric} e={e} />)}
        </Expand>
      )}
    </Card>
  );
}

/** Ranked, explainable insights — each expandable to its evidence trail. */
/** Weekly "what changed and why" — the single biggest 7-day mover paired with a
 * likely driver from the relationship engine. */
export function WeeklyDigestCard({ digest }: { digest: WeeklyDigest }) {
  if (!digest.available) return null;
  const improving = digest.improving;
  const c = improving ? "#13b57e" : "#ef5a45";
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${c}1f`, color: c }}>
          {improving ? <TrendingUp size={17} /> : <TrendingDown size={17} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink-50">{digest.title}</p>
            <ConfPill c={digest.confidence} />
          </div>
          <p className="mt-1 text-xs leading-relaxed text-ink-300">{digest.detail}</p>
          {digest.driver && (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-black/[0.03] px-3 py-2 text-xs leading-relaxed text-ink-400">
              <Sparkles size={13} className="mt-0.5 shrink-0 text-ink-400" />
              <span><span className="font-medium text-ink-200">Likely driver:</span> {digest.driver}</span>
            </p>
          )}
          <p className="mt-2 flex items-center gap-1 text-[10px] uppercase tracking-wide text-ink-500">
            <CalendarRange size={11} /> based on {digest.basisDays} days of your data
          </p>
        </div>
      </div>
    </Card>
  );
}

export function IntelligenceInsights({ insights, empty, basisDays }: { insights: AnalyticsInsight[]; empty?: string; basisDays?: number }) {
  if (!insights.length) return <Card className="p-5 text-sm text-ink-400">{empty ?? "Not enough history yet — insights sharpen as your baseline fills in."}</Card>;
  return (
    <div className="space-y-3">
      {typeof basisDays === "number" && basisDays > 0 && (
        <p className="flex items-center gap-1 px-1 text-[11px] text-ink-500">
          <CalendarRange size={11} /> Drawn from {basisDays} days of your data — reliability grows as history fills in.
        </p>
      )}
      {insights.map((i) => (
        <Card key={i.id} className="p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/[0.06] text-ink-200"><Sparkles size={15} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink-100">{i.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-400">{i.detail}</p>
            </div>
            <ConfPill c={i.confidence} />
          </div>
          <Expand label="Why CURA flagged this">
            <p className="text-[11px] leading-relaxed text-ink-300">{i.evidence.explanation}</p>
            {i.evidence.baselineComparisons.length > 0 && <div className="mt-1.5 space-y-1.5">{i.evidence.baselineComparisons.map((e) => <EvidenceRow key={e.metric} e={e} />)}</div>}
            <p className="mt-1.5 text-[10px] uppercase tracking-wide text-ink-500">Window: {i.evidence.timeWindow}</p>
          </Expand>
        </Card>
      ))}
    </div>
  );
}
