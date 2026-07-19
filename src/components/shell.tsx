"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import {
  Activity,
  BarChart3,
  Beaker,
  CalendarDays,
  FileText,
  LayoutDashboard,
  MessageCircle,
  Sparkles,
  Upload,
  UtensilsCrossed,
  Waves,
  Lock,
  Menu,
  Plug,
  X,
} from "lucide-react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, color: "#7c6bff" },
  { href: "/nutrition", label: "Nutrition", icon: UtensilsCrossed, color: "#34d399" },
  { href: "/insights", label: "AI Discoveries", icon: Sparkles, color: "#2dd4ee" },
  { href: "/correlations", label: "Correlations", icon: BarChart3, color: "#fb7bb8" },
  { href: "/chat", label: "Ask Your Data", icon: MessageCircle, color: "#fbbf24" },
  { href: "/coach", label: "AI Coach", icon: Activity, color: "#fb8a67" },
  { href: "/timeline", label: "Timeline", icon: CalendarDays, color: "#4d9fff" },
  { href: "/experiments", label: "Experiments", icon: Beaker, color: "#a78bfa" },
  { href: "/report", label: "Health Report", icon: FileText, color: "#fb7bb8" },
];

const SECONDARY_NAV = [
  { href: "/connections", label: "Connections", icon: Plug },
  { href: "/upload", label: "Upload data", icon: Upload },
  { href: "/privacy", label: "Privacy", icon: Lock },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon, color }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
              active ? "text-white" : "text-base-400 hover:text-base-100 hover:bg-white/[0.05]"
            )}
          >
            {active && (
              <motion.span
                layoutId="nav-active"
                className="absolute inset-0 rounded-xl border border-white/[0.1] bg-gradient-to-r from-white/[0.1] to-white/[0.04]"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span
              className="relative z-10 flex h-6 w-6 items-center justify-center rounded-md transition-transform group-hover:scale-110"
              style={{ background: `${color}26`, color: active ? color : undefined }}
            >
              <Icon size={14} strokeWidth={2} style={{ color }} />
            </span>
            <span className="relative z-10 font-medium">{label}</span>
          </Link>
        );
      })}
      <div className="mt-auto space-y-0.5 pt-6">
        {SECONDARY_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-white/[0.06] text-base-100" : "text-base-400 hover:bg-white/[0.04] hover:text-base-100"
              )}
            >
              <Icon size={16} strokeWidth={1.8} /> {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function DataBadge() {
  const meta = useApp((s) => s.meta);
  const days = useApp((s) => s.days);
  const calendarMeta = useApp((s) => s.calendarMeta);
  const calendarEvents = useApp((s) => s.calendarEvents);
  const hydrated = useApp((s) => s.hydrated);
  if (!hydrated) return null;
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
      {meta ? (
        <>
          <div className="text-xs font-medium text-base-100">{meta.source}</div>
          <div className="mt-0.5 text-[11px] text-base-400">
            {days.length} days · {days[0]?.date?.slice(5)} → {days[days.length - 1]?.date?.slice(5)}
          </div>
          {calendarMeta ? (
            <div className="mt-1 text-[11px] text-base-400">
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-status-good align-middle" />
              {calendarMeta.source} · {calendarEvents.length} events
            </div>
          ) : (
            <Link href="/upload#calendar" className="mt-1 block text-[11px] text-accent-soft hover:underline">
              + Connect calendar
            </Link>
          )}
        </>
      ) : (
        <div className="text-[11px] leading-relaxed text-base-400">
          No data loaded.{" "}
          <Link href="/upload" className="text-accent-soft hover:underline">
            Upload
          </Link>{" "}
          or try the demo.
        </div>
      )}
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col gap-6 border-r border-white/[0.08] bg-base-900/50 px-3 py-5 backdrop-blur-xl lg:flex">
        <Link href="/" className="group flex items-center gap-2.5 px-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-vivid-violet to-vivid-cyan text-white shadow-glow transition-transform group-hover:scale-110 group-hover:rotate-6">
            <Waves size={17} strokeWidth={2} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Recovery Intelligence</span>
        </Link>
        <NavLinks />
        <DataBadge />
      </aside>

      {/* Mobile top bar */}
      <div className="glass fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between px-4 lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-vivid-violet to-vivid-cyan text-white">
            <Waves size={15} />
          </span>
          <span className="text-sm font-semibold">Recovery Intelligence</span>
        </Link>
        <button
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-base-200 hover:bg-white/[0.06]"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="glass fixed inset-x-3 top-16 z-40 flex flex-col rounded-2xl p-3 lg:hidden"
          >
            <NavLinks onNavigate={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <main className="min-w-0 flex-1 px-4 pb-20 pt-20 sm:px-6 lg:ml-60 lg:px-10 lg:pt-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
