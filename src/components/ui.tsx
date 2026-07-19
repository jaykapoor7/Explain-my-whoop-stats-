"use client";

import { cn } from "@/lib/utils";
import { motion, useInView, useSpring } from "framer-motion";
import Link from "next/link";
import { ReactNode, useEffect, useRef } from "react";

/* Minimal shadcn-style primitives, tuned for the dark-first aesthetic. */

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card p-5", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <h3 className={cn("text-sm font-medium text-base-200", className)}>{children}</h3>;
}

export function SectionHeading({ title, subtitle, id }: { title: string; subtitle?: string; id?: string }) {
  return (
    <div id={id} className="mb-4 mt-10 scroll-mt-24 first:mt-0">
      <div className="flex items-center gap-2.5">
        <span className="h-5 w-1 rounded-full bg-gradient-to-b from-vivid-violet via-vivid-cyan to-vivid-pink" />
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      {subtitle && <p className="ml-[14px] mt-0.5 text-sm text-base-400">{subtitle}</p>}
    </div>
  );
}

const buttonStyles = {
  primary: "btn-gradient text-white shadow-glow",
  accent: "bg-accent text-white hover:bg-accent-soft shadow-glow",
  ghost: "bg-transparent text-base-200 hover:bg-white/[0.08] border border-white/15",
  subtle: "bg-white/[0.08] text-base-100 hover:bg-white/[0.12]",
  danger: "bg-status-critical/15 text-[#ffa2b0] hover:bg-status-critical/25 border border-status-critical/30",
} as const;

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonStyles;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98]",
        size === "sm" && "h-8 px-3.5 text-xs",
        size === "md" && "h-10 px-5 text-sm",
        size === "lg" && "h-12 px-7 text-[15px]",
        buttonStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: keyof typeof buttonStyles;
  size?: "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 active:scale-[0.98]",
        size === "sm" && "h-8 px-3.5 text-xs",
        size === "md" && "h-10 px-5 text-sm",
        size === "lg" && "h-12 px-7 text-[15px]",
        buttonStyles[variant],
        className
      )}
    >
      {children}
    </Link>
  );
}

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: "neutral" | "good" | "warning" | "critical" | "accent";
  className?: string;
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-white/[0.09] text-base-200",
    good: "bg-status-good/15 text-[#6ee7b7]",
    warning: "bg-status-warning/15 text-[#fcd34d]",
    critical: "bg-status-critical/15 text-[#ffa2b0]",
    accent: "bg-accent/20 text-accent-soft",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide", tones[tone], className)}>
      {children}
    </span>
  );
}

/** Animated number that springs from 0 when scrolled into view. Handles "1,234"-style strings. */
export function CountUp({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-30px" });
  const numeric = parseFloat(value.replace(/,/g, ""));
  const isNumeric = isFinite(numeric) && /^[\d,.\-]+$/.test(value.trim());
  const decimals = isNumeric && value.includes(".") ? value.split(".")[1].length : 0;
  const useGrouping = value.includes(",");
  const spring = useSpring(0, { stiffness: 65, damping: 18 });

  useEffect(() => {
    if (inView && isNumeric) spring.set(numeric);
  }, [inView, isNumeric, numeric, spring]);

  useEffect(() => {
    if (!isNumeric) return;
    return spring.on("change", (v) => {
      if (ref.current)
        ref.current.textContent = v.toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
          useGrouping,
        });
    });
  }, [spring, decimals, isNumeric, useGrouping]);

  if (!isNumeric) return <span className={className}>{value}</span>;
  return (
    <span ref={ref} className={cn("tabular", className)}>
      0
    </span>
  );
}

export function StatTile({
  label,
  value,
  unit,
  delta,
  deltaGood,
  sub,
  className,
  accent = "#7c6bff",
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaGood?: boolean | null;
  sub?: string;
  className?: string;
  accent?: string;
}) {
  return (
    <Card className={cn("card-hover relative flex flex-col gap-1 overflow-hidden", className)}>
      <span
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-25 blur-2xl"
        style={{ background: accent }}
      />
      <span className="text-xs font-medium uppercase tracking-wider text-base-400">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <CountUp value={value} className="text-3xl font-semibold tracking-tight" />
        {unit && <span className="text-sm text-base-400">{unit}</span>}
        {delta && (
          <span
            className={cn(
              "ml-auto text-xs font-medium tabular",
              deltaGood === true && "text-[#6ee7b7]",
              deltaGood === false && "text-[#ffa2b0]",
              deltaGood == null && "text-base-400"
            )}
          >
            {delta}
          </span>
        )}
      </div>
      {sub && <span className="text-xs text-base-400">{sub}</span>}
    </Card>
  );
}

/** Animated circular gauge with a vivid gradient stroke. */
export function RingGauge({
  value,
  max = 100,
  size = 132,
  label,
  display,
  color,
}: {
  value: number;
  max?: number;
  size?: number;
  label?: string;
  display?: string;
  color?: string;
}) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, value / max));
  const gradId = `ring-grad-${(color ?? "default").replace(/[^a-z0-9]/gi, "")}`;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color ?? "#7c6bff"} />
            <stop offset="55%" stopColor={color ?? "#2dd4ee"} />
            <stop offset="100%" stopColor={color ?? "#34d399"} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: c * (1 - frac) }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: [0.22, 0.61, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <CountUp value={display ?? String(Math.round(value))} className="text-3xl font-bold tracking-tight" />
        {label && <span className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-base-400">{label}</span>}
      </div>
    </div>
  );
}

export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Tiny markdown renderer for chat/coach copy (bold, italics, lists, line breaks). */
export function MiniMarkdown({ text, className }: { text: string; className?: string }) {
  const html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split("\n");
      if (lines.every((l) => l.trim().startsWith("- "))) {
        return `<ul>${lines.map((l) => `<li>${l.trim().slice(2)}</li>`).join("")}</ul>`;
      }
      return `<p>${block.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");
  return <div className={cn("markdown text-sm leading-relaxed text-base-200", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function EmptyState({ title, body, cta }: { title: string; body: string; cta?: ReactNode }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        className="gradient-ring flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-glow"
      >
        📈
      </motion.div>
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 max-w-sm text-sm text-base-400">{body}</p>
      </div>
      {cta}
    </div>
  );
}
