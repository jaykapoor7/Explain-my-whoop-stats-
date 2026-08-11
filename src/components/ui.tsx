"use client";

import { ReactNode, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, HelpCircle } from "lucide-react";
import { cn, signed } from "@/lib/format";
import { Contributor } from "@/lib/types";

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card p-5", className)} {...props}>
      {children}
    </div>
  );
}

export function Section({ title, sub, action, children, className }: { title: string; sub?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("mt-8", className)}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink-50">{title}</h2>
          {sub && <p className="mt-0.5 text-xs text-ink-400">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Big score ring with arc fill; the visual anchor of every score page. */
export function ScoreRing({
  score,
  scale = 100,
  color,
  size = 148,
  label,
  sublabel,
}: {
  score: number;
  scale?: number;
  color: string;
  size?: number;
  label?: string;
  sublabel?: string;
}) {
  const stroke = size >= 120 ? 11 : 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0.015, Math.min(1, score / scale));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - frac) }}
          transition={{ duration: 1.1, ease: [0.22, 0.61, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular font-bold tracking-tight text-ink-50" style={{ fontSize: size / 3.4 }}>
          {scale === 21 ? score.toFixed(1) : Math.round(score)}
        </span>
        {label && <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">{label}</span>}
        {sublabel && <span className="mt-0.5 text-[10px] text-ink-500">{sublabel}</span>}
      </div>
    </div>
  );
}

export function Delta({ value, decimals = 0, invert = false, suffix = "" }: { value: number; decimals?: number; invert?: boolean; suffix?: string }) {
  if (!isFinite(value) || Math.abs(value) < 0.05)
    return <span className="tabular text-xs text-ink-400">±0{suffix}</span>;
  const good = invert ? value < 0 : value > 0;
  return (
    <span className={cn("tabular text-xs font-medium", good ? "text-good" : "text-bad")}>
      {signed(value, decimals)}
      {suffix}
    </span>
  );
}

export function StatusPill({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: `${color}1f`, color }}
    >
      {text}
    </span>
  );
}

/** The "What affected you" ledger — signed contributor rows. */
export function ContributorLedger({ contributors, unit = "" }: { contributors: Contributor[]; unit?: string }) {
  if (!contributors.length)
    return <p className="text-sm text-ink-400">Nothing moved this score meaningfully today.</p>;
  const max = Math.max(...contributors.map((c) => Math.abs(c.points)), 1);
  return (
    <div className="space-y-1">
      {contributors.map((c, i) => (
        <div key={`${c.label}-${i}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.03]">
          <span className={cn("w-4 text-center text-sm", c.points > 0 ? "text-good" : c.points < 0 ? "text-bad" : "text-ink-400")}>
            {c.points > 0 ? "↑" : c.points < 0 ? "↓" : "·"}
          </span>
          <div className="min-w-0 flex-1">
            <span className="text-sm text-ink-100">{c.label}</span>
            {c.detail && <span className="ml-2 hidden text-xs text-ink-400 sm:inline">{c.detail}</span>}
          </div>
          <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.06] sm:block">
            <div
              className={cn("h-full rounded-full", c.points >= 0 ? "bg-good" : "bg-bad")}
              style={{ width: `${(Math.abs(c.points) / max) * 100}%`, opacity: 0.8 }}
            />
          </div>
          <span className={cn("tabular w-12 text-right text-sm font-semibold", c.points > 0 ? "text-good" : c.points < 0 ? "text-bad" : "text-ink-400")}>
            {signed(c.points)}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Expandable "Why?" explainer. */
export function Why({ summary, children }: { summary: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left">
        <HelpCircle size={14} className="shrink-0 text-ink-400" />
        <span className="flex-1 text-sm text-ink-200">{summary}</span>
        <ChevronDown size={14} className={cn("shrink-0 text-ink-400 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.05] px-3.5 py-3 text-sm leading-relaxed text-ink-300">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ProgressBar({ value, max, color, invertOver = false }: { value: number; max: number; color: string; invertOver?: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const over = value > max;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
      <motion.div
        className="h-full rounded-full"
        style={{ background: over && invertOver ? "#ff6b6b" : color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

export function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  const map = {
    high: { c: "#38d39f", t: "High confidence" },
    medium: { c: "#f6b83b", t: "Medium confidence" },
    low: { c: "#ff6b6b", t: "Low confidence" },
  } as const;
  return <StatusPill text={map[level].t} color={map[level].c} />;
}

export function EmptyState({ title, body, icon }: { title: string; body: string; icon?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
      {icon && <div className="mb-1 text-ink-400">{icon}</div>}
      <h3 className="text-sm font-semibold text-ink-100">{title}</h3>
      <p className="max-w-sm text-xs leading-relaxed text-ink-400">{body}</p>
    </div>
  );
}

export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink-50">{title}</h1>
        {sub && <p className="mt-1 text-sm text-ink-400">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-8 w-48 rounded-lg" />
      <div className="skeleton h-44 rounded-2xl" />
      <div className="skeleton h-64 rounded-2xl" />
    </div>
  );
}
