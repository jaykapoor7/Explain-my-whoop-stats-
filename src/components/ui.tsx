"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";
import { ReactNode } from "react";

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
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-base-400">{subtitle}</p>}
    </div>
  );
}

const buttonStyles = {
  primary:
    "bg-white text-base-950 hover:bg-base-100 shadow-[0_1px_0_rgba(255,255,255,0.3)_inset]",
  accent: "bg-accent text-white hover:bg-accent-soft shadow-glow",
  ghost: "bg-transparent text-base-200 hover:bg-white/[0.06] border border-white/10",
  subtle: "bg-white/[0.06] text-base-100 hover:bg-white/[0.1]",
  danger: "bg-status-critical/15 text-[#f28b8b] hover:bg-status-critical/25 border border-status-critical/30",
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
    neutral: "bg-white/[0.07] text-base-200",
    good: "bg-status-good/15 text-[#5ecb5e]",
    warning: "bg-status-warning/15 text-[#f7c95c]",
    critical: "bg-status-critical/15 text-[#f28b8b]",
    accent: "bg-accent/15 text-accent-soft",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide", tones[tone], className)}>
      {children}
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
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaGood?: boolean | null;
  sub?: string;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-medium uppercase tracking-wider text-base-400">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight">{value}</span>
        {unit && <span className="text-sm text-base-400">{unit}</span>}
        {delta && (
          <span
            className={cn(
              "ml-auto text-xs font-medium tabular",
              deltaGood === true && "text-[#5ecb5e]",
              deltaGood === false && "text-[#f28b8b]",
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
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05] text-2xl">📈</div>
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 max-w-sm text-sm text-base-400">{body}</p>
      </div>
      {cta}
    </div>
  );
}
