"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BatteryCharging,
  CalendarDays,
  Flame,
  Grid2x2,
  HeartPulse,
  LineChart,
  Moon,
  NotebookPen,
  Pill,
  Settings,
  Sun,
  Target,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { cn } from "@/lib/format";

const NAV = [
  { href: "/today", label: "Today", icon: Sun, color: "#eef0f4" },
  { href: "/energy", label: "Energy", icon: BatteryCharging, color: "#f6b83b" },
  { href: "/recovery", label: "Recovery", icon: HeartPulse, color: "#38d39f" },
  { href: "/sleep", label: "Sleep", icon: Moon, color: "#8b8cff" },
  { href: "/strain", label: "Strain", icon: Flame, color: "#ff7a5c" },
  { href: "/nutrition", label: "Nutrition", icon: UtensilsCrossed, color: "#5cc8ff" },
  { href: "/medication", label: "Medication", icon: Pill, color: "#e089d2" },
  { href: "/journal", label: "Journal", icon: NotebookPen, color: "#c9b98a" },
  { href: "/trends", label: "Trends", icon: LineChart, color: "#7dd3fc" },
  { href: "/planner", label: "Planner", icon: CalendarDays, color: "#9fb6ff" },
  { href: "/goals", label: "Goals", icon: Target, color: "#8ee06a" },
  { href: "/settings", label: "Settings", icon: Settings, color: "#8b93a1" },
];

// Bottom tab bar shows the daily-driver five; the rest live behind "More".
const MOBILE_PRIMARY = ["/today", "/energy", "/sleep", "/nutrition"];

function DesktopNav() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-white/[0.06] bg-ink-900/70 px-3 py-5 backdrop-blur-xl lg:flex">
      <Link href="/today" className="mb-6 flex items-center gap-2.5 px-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-recovery to-sleep text-ink-950">
          <Activity size={17} strokeWidth={2.4} />
        </span>
        <div>
          <div className="text-[14px] font-bold leading-none tracking-tight text-ink-50">Health OS</div>
          <div className="mt-0.5 text-[10px] text-ink-400">Fitbit Air · open source</div>
        </div>
      </Link>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon, color }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition-colors",
                active ? "text-ink-50" : "text-ink-400 hover:bg-white/[0.04] hover:text-ink-100"
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-xl border border-white/[0.08] bg-white/[0.06]"
                  transition={{ type: "spring", bounce: 0.16, duration: 0.5 }}
                />
              )}
              <Icon size={15} strokeWidth={2} className="relative z-10" style={{ color: active ? color : undefined }} />
              <span className="relative z-10 font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = NAV.filter((n) => MOBILE_PRIMARY.includes(n.href));
  const rest = NAV.filter((n) => !MOBILE_PRIMARY.includes(n.href));
  const moreActive = rest.some((n) => pathname.startsWith(n.href));

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] bg-ink-900/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {primary.map(({ href, label, icon: Icon, color }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href} className="flex flex-1 flex-col items-center gap-1 py-2.5" onClick={() => setMoreOpen(false)}>
                <Icon size={19} strokeWidth={2} style={{ color: active ? color : "#6b7482" }} />
                <span className={cn("text-[10px] font-medium", active ? "text-ink-100" : "text-ink-400")}>{label}</span>
              </Link>
            );
          })}
          <button onClick={() => setMoreOpen(!moreOpen)} className="flex flex-1 flex-col items-center gap-1 py-2.5">
            <Grid2x2 size={19} strokeWidth={2} style={{ color: moreOpen || moreActive ? "#eef0f4" : "#6b7482" }} />
            <span className={cn("text-[10px] font-medium", moreOpen || moreActive ? "text-ink-100" : "text-ink-400")}>More</span>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.button
              aria-label="Close menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMoreOpen(false)}
              className="fixed inset-0 z-40 bg-ink-950/70 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", bounce: 0.1, duration: 0.45 }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-white/[0.08] bg-ink-850 p-5 pb-[calc(env(safe-area-inset-bottom)+72px)] lg:hidden"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-ink-100">All sections</span>
                <button onClick={() => setMoreOpen(false)} className="text-ink-400" aria-label="Close">
                  <X size={18} />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {rest.map(({ href, label, icon: Icon, color }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-2 py-3.5"
                  >
                    <Icon size={19} strokeWidth={2} style={{ color }} />
                    <span className="text-[10px] font-medium text-ink-200">{label}</span>
                  </Link>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <DesktopNav />
      <MobileNav />
      <main className="mx-auto min-w-0 max-w-3xl px-4 pb-28 pt-6 sm:px-6 lg:ml-56 lg:max-w-4xl lg:pb-12 lg:pt-8 xl:mx-auto xl:pl-56">
        {children}
      </main>
    </div>
  );
}
