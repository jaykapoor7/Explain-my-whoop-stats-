"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { ArrowLeft, ChevronDown, HelpCircle } from "lucide-react";
import { cn, signed } from "@/lib/format";
import { Contributor } from "@/lib/types";

/** Animated number that counts up from 0 to `value` once, on mount. */
function CountUp({ value, decimals = 0, className, style }: { value: number; decimals?: number; className?: string; style?: React.CSSProperties }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  useEffect(() => {
    if (!inView) return;
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return setDisplay(value);
    let raf = 0;
    const start = performance.now();
    const dur = 950;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);
  return (
    <span ref={ref} className={className} style={style}>
      {display.toFixed(decimals)}
    </span>
  );
}

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card p-5", className)} {...props}>
      {children}
    </div>
  );
}

export function Section({ title, sub, action, children, className }: { title: string; sub?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <motion.section
      className={cn("mt-8", className)}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
    >
      <div className="mb-3.5 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-ink-50">{title}</h2>
          {sub && <p className="mt-1 text-[13px] text-ink-400">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </motion.section>
  );
}

/** Big score ring with a gradient arc, soft halo glow and a leading-edge dot. */
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
  const big = size >= 120;
  const stroke = big ? 12 : 8.5;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0.015, Math.min(1, score / scale));
  const key = color.replace(/[^a-z0-9]/gi, "");
  const gid = `ring-${key}-${size}`;
  // Leading edge of the arc, in the SVG's own (pre-rotation) coordinates.
  const theta = frac * 2 * Math.PI;
  const dotX = cx + r * Math.cos(theta);
  const dotY = cx + r * Math.sin(theta);
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      {/* soft coloured halo behind the ring */}
      <div
        className="pointer-events-none absolute rounded-full"
        style={{ inset: size * 0.14, background: color, filter: `blur(${size * 0.16}px)`, opacity: 0.18 }}
      />
      <svg width={size} height={size} className="relative" style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.5" />
            <stop offset="55%" stopColor={color} stopOpacity="0.92" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth={stroke} />
        <motion.circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - frac) }}
          transition={{ duration: 1.25, ease: [0.22, 0.61, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 ${big ? 8 : 4}px ${color}5c)` }}
        />
        {big && (
          <motion.circle
            cx={dotX}
            cy={dotY}
            r={stroke / 2 - 1.5}
            fill="#fff"
            stroke={color}
            strokeWidth={2}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.25, duration: 0.4 }}
            style={{ filter: `drop-shadow(0 0 5px ${color})` }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <CountUp
          value={scale === 21 ? score : Math.round(score)}
          decimals={scale === 21 ? 1 : 0}
          className="tabular font-display font-bold tracking-tight text-ink-50"
          style={{ fontSize: size / 3.4 }}
        />
        {label && <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">{label}</span>}
        {sublabel && <span className="mt-0.5 text-[10px] text-ink-500">{sublabel}</span>}
      </div>
    </div>
  );
}

/** WHOOP-style overview dial: a centered ring with a metric label beneath, tappable. */
export function DialTile({
  href,
  label,
  score,
  scale = 100,
  color,
  available = true,
  sub,
  delta,
}: {
  href: string;
  label: string;
  score: number;
  scale?: number;
  color: string;
  available?: boolean;
  sub?: string;
  delta?: number;
}) {
  const inner = (
    <div className="card flex flex-col items-center gap-2.5 px-3 py-5 text-center transition-all hover:-translate-y-0.5 hover:shadow-lift">
      {available ? (
        <ScoreRing score={score} scale={scale} color={color} size={92} />
      ) : (
        <span className="flex h-[92px] w-[92px] items-center justify-center rounded-full border border-dashed border-black/15 text-lg text-ink-500">—</span>
      )}
      <div className="flex flex-col items-center">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color }}>
          {label}
        </span>
        <span className="mt-0.5 text-[11px] text-ink-400">{available ? sub ?? "" : "No data yet"}</span>
        {available && delta !== undefined && (
          <span className="mt-0.5">
            <Delta value={delta} decimals={scale === 21 ? 1 : 0} />
          </span>
        )}
      </div>
    </div>
  );
  return (
    <Link href={href} className="group flex-1">
      {inner}
    </Link>
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
function LedgerRow({ c, max, unit }: { c: Contributor; max: number; unit: string }) {
  const [open, setOpen] = useState(false);
  // Something to reveal? Show the maths on tap; on mobile also surface the detail
  // line that's otherwise hidden for space.
  const expandable = !!(c.math || c.detail);
  return (
    <div className={cn("rounded-lg transition-colors", open ? "bg-black/[0.03]" : "hover:bg-black/[0.03]")}>
      <button
        type="button"
        onClick={() => expandable && setOpen((v) => !v)}
        className={cn("flex w-full items-center gap-3 px-2 py-1.5 text-left", !expandable && "cursor-default")}
        aria-expanded={expandable ? open : undefined}
      >
        <span className={cn("w-4 text-center text-sm", c.points > 0 ? "text-good" : c.points < 0 ? "text-bad" : "text-ink-400")}>
          {c.points > 0 ? "↑" : c.points < 0 ? "↓" : "·"}
        </span>
        <div className="min-w-0 flex-1">
          <span className="text-sm text-ink-100">{c.label}</span>
          {c.detail && <span className="ml-2 hidden text-xs text-ink-400 sm:inline">{c.detail}</span>}
        </div>
        <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-black/[0.06] sm:block">
          <div className={cn("h-full rounded-full", c.points >= 0 ? "bg-good" : "bg-bad")} style={{ width: `${(Math.abs(c.points) / max) * 100}%`, opacity: 0.8 }} />
        </div>
        <span className={cn("tabular w-12 text-right text-sm font-semibold", c.points > 0 ? "text-good" : c.points < 0 ? "text-bad" : "text-ink-400")}>
          {signed(c.points)}{unit}
        </span>
        {expandable && <ChevronDown size={13} className={cn("shrink-0 text-ink-400 transition-transform", open && "rotate-180")} />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-9 pb-2.5 pt-0.5 text-xs leading-relaxed text-ink-400">
              {c.detail && <span className="sm:hidden">{c.detail}. </span>}
              {c.math}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ContributorLedger({ contributors, unit = "" }: { contributors: Contributor[]; unit?: string }) {
  if (!contributors.length)
    return <p className="text-sm text-ink-400">Nothing moved this score meaningfully today.</p>;
  const max = Math.max(...contributors.map((c) => Math.abs(c.points)), 1);
  const anyExpandable = contributors.some((c) => c.math || c.detail);
  return (
    <div className="space-y-1">
      {contributors.map((c, i) => (
        <LedgerRow key={`${c.label}-${i}`} c={c} max={max} unit={unit} />
      ))}
      {anyExpandable && <p className="px-2 pt-1.5 text-[11px] text-ink-500">Tap a factor to see how it was calculated.</p>}
    </div>
  );
}

/** Expandable "Why?" explainer. */
export function Why({ summary, children }: { summary: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 rounded-xl border border-black/[0.06] bg-black/[0.02]">
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
            <div className="border-t border-black/[0.05] px-3.5 py-3 text-sm leading-relaxed text-ink-300">{children}</div>
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
    <div className="h-2 overflow-hidden rounded-full bg-black/[0.07]">
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

/** A subtle "go back" control. Falls back to Today if there's no history to pop
 * (e.g. the page was opened directly from a deep link or the widget). */
export function BackButton({ className }: { className?: string }) {
  const router = useRouter();
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/today");
  };
  return (
    <button
      onClick={goBack}
      className={cn(
        "group -ml-1 inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-[13px] font-medium text-ink-400 transition-colors hover:text-ink-100",
        className,
      )}
      aria-label="Go back"
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/[0.05] transition-colors group-hover:bg-black/[0.1]">
        <ArrowLeft size={14} />
      </span>
      Back
    </button>
  );
}

export function PageHeader({ title, sub, right, back }: { title: string; sub?: string; right?: ReactNode; back?: boolean }) {
  return (
    <div>
      {back && <BackButton className="mb-3" />}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.02em] text-ink-50 sm:text-[2.5rem]">{title}</h1>
          {sub && <p className="mt-1.5 max-w-xl text-[15px] leading-snug text-ink-400">{sub}</p>}
        </div>
        {right}
      </div>
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
