"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  Grid2x2,
  LineChart,
  NotebookPen,
  Pill,
  Settings,
  Sun,
  Target,
  User,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { cn } from "@/lib/format";
import { AutoSync } from "@/components/auto-sync";
import { AccountProvider, AccountChip } from "@/components/account";
import { Coach } from "@/components/coach";
import { FloatingBack } from "@/components/ui";
import { Logo } from "@/components/logo";

// The daily metrics (Energy, Recovery, Sleep, Strain, Health Age) are reached
// by tapping their cards on Today, so the nav stays to the tools + views.
const NAV = [
  { href: "/today", label: "Today", icon: Sun, color: "#211c14", group: "" },
  { href: "/trends", label: "Trends", icon: LineChart, color: "#2a8fc4", group: "" },
  { href: "/nutrition", label: "Nutrition", icon: UtensilsCrossed, color: "#2298cf", group: "Track" },
  { href: "/medication", label: "Medication", icon: Pill, color: "#c2569f", group: "Track" },
  { href: "/journal", label: "Journal", icon: NotebookPen, color: "#a98b3f", group: "Track" },
  { href: "/planner", label: "Planner", icon: CalendarDays, color: "#5b6fd6", group: "Track" },
  { href: "/goals", label: "Goals", icon: Target, color: "#4fa82f", group: "You" },
  { href: "/friends", label: "Friends", icon: Users, color: "#e0894e", group: "You" },
  { href: "/profile", label: "Profile", icon: User, color: "#4a8f7a", group: "You" },
  { href: "/settings", label: "Settings", icon: Settings, color: "#6b6252", group: "You" },
];

// Bottom tab bar keeps the four daily-use views; everything else lives behind
// a "More" sheet so the bar stays uncrowded.
const MOBILE_PRIMARY = ["/today", "/nutrition", "/medication", "/planner"];

function DesktopNav() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-black/[0.06] bg-ink-900/75 px-3 py-5 backdrop-blur-xl lg:flex">
      <Link href="/today" className="mb-7 flex items-center gap-2.5 px-2">
        <Logo size={34} className="shrink-0" />
        <div>
          <div className="font-display text-[18px] font-bold leading-none tracking-[0.14em] text-ink-50">CURA</div>
          <div className="mt-1 text-[10px] tracking-wide text-ink-400">your body, clearly</div>
        </div>
      </Link>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon, color, group }, i) => {
          const active = pathname.startsWith(href);
          const newGroup = group && group !== (NAV[i - 1]?.group ?? "");
          return (
            <div key={href}>
              {newGroup && (
                <div className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">{group}</div>
              )}
              <Link
                href={href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition-colors",
                  active ? "text-ink-50" : "text-ink-400 hover:text-ink-100"
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-xl border border-black/[0.05] bg-[#fffefb] shadow-[0_1px_2px_rgba(59,46,20,0.07),0_1px_0_rgba(255,255,255,0.8)_inset]"
                    transition={{ type: "spring", bounce: 0.16, duration: 0.5 }}
                  />
                ) : (
                  <span className="absolute inset-0 rounded-xl opacity-0 transition-opacity group-hover:bg-black/[0.03] group-hover:opacity-100" />
                )}
                <Icon size={15} strokeWidth={2.1} className="relative z-10 transition-colors" style={{ color: active ? color : undefined }} />
                <span className={cn("relative z-10", active ? "font-semibold" : "font-medium")}>{label}</span>
              </Link>
            </div>
          );
        })}
      </nav>
      <div className="mt-2 shrink-0 border-t border-black/[0.06] pt-3">
        <AccountChip />
      </div>
    </aside>
  );
}

/** Four daily-use tabs plus a "More" sheet for the rest — keeps the bar clean
 * while still putting every section one tap away. */
function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = NAV.filter((n) => MOBILE_PRIMARY.includes(n.href));
  const rest = NAV.filter((n) => !MOBILE_PRIMARY.includes(n.href));
  const moreActive = rest.some((n) => pathname.startsWith(n.href));

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.07] bg-ink-900/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {primary.map(({ href, label, icon: Icon, color }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href} className="flex flex-1 flex-col items-center gap-1 py-2.5" onClick={() => setMoreOpen(false)}>
                <Icon size={19} strokeWidth={2} style={{ color: active ? color : "#9a8f78" }} />
                <span className={cn("text-[10px] font-medium", active ? "text-ink-100" : "text-ink-400")}>{label}</span>
              </Link>
            );
          })}
          <button onClick={() => setMoreOpen(!moreOpen)} className="flex flex-1 flex-col items-center gap-1 py-2.5">
            <Grid2x2 size={19} strokeWidth={2} style={{ color: moreOpen || moreActive ? "#211c14" : "#9a8f78" }} />
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
              className="fixed inset-0 z-40 bg-[#2a2417]/35 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", bounce: 0.1, duration: 0.45 }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-black/[0.08] bg-ink-850 p-5 pb-[calc(env(safe-area-inset-bottom)+72px)] lg:hidden"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-ink-100">All sections</span>
                <button onClick={() => setMoreOpen(false)} className="text-ink-400" aria-label="Close">
                  <X size={18} />
                </button>
              </div>
              <div className="mb-4"><AccountChip /></div>
              <div className="grid grid-cols-4 gap-3">
                {rest.map(({ href, label, icon: Icon, color }) => {
                  const active = pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3.5",
                        active ? "border-black/[0.12] bg-black/[0.06]" : "border-black/[0.06] bg-black/[0.03]"
                      )}
                    >
                      <Icon size={19} strokeWidth={2} style={{ color }} />
                      <span className="text-[10px] font-medium text-ink-200">{label}</span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Public pages — the marketing home and the legal documents (linked from the
  // Google OAuth consent screen and footers) — render clean, with no app nav or
  // Coach. The landing at "/" needs its own full-width layout, so render it raw.
  if (pathname === "/") return <>{children}</>;
  const isLegal = pathname === "/privacy" || pathname === "/terms";
  if (isLegal) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto min-w-0 max-w-3xl px-5 py-10 sm:py-14">{children}</main>
      </div>
    );
  }
  return (
    <AccountProvider>
      <div className="min-h-screen">
        <AutoSync />
        <DesktopNav />
        <MobileNav />
        <main className="mx-auto min-w-0 max-w-3xl px-4 pb-28 pt-6 sm:px-6 lg:ml-56 lg:max-w-5xl lg:pb-12 lg:pt-8 xl:mx-auto xl:max-w-6xl xl:pl-56">
          {children}
        </main>
        {/* A back control on every app page — fades in top-left as you scroll,
            so there's always a way back from any page or drilled-in section. */}
        <FloatingBack />
        <Coach />
      </div>
    </AccountProvider>
  );
}
