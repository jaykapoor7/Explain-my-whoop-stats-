import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Domain } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function todayISO(): string {
  const d = new Date();
  return isoOf(d);
}

export function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return isoOf(d);
}

export function fmtDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", opts ?? { month: "short", day: "numeric" });
}

export function fmtDateLong(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function relativeDay(iso: string): string {
  const t = todayISO();
  if (iso === t) return "Today";
  if (iso === addDays(t, -1)) return "Yesterday";
  if (iso === addDays(t, 1)) return "Tomorrow";
  return fmtDate(iso, { weekday: "short", month: "short", day: "numeric" });
}

/** Local hour label from an ISO datetime or an "HH:MM" string. */
export function fmtTime(v: string): string {
  const m = v.match(/(\d{1,2}):(\d{2})/);
  if (!m) return v;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 === 0 ? 12 : h % 12;
  return `${h}:${min} ${ampm}`;
}

export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function fmtNum(v: number | undefined | null, decimals = 0): string {
  if (v === undefined || v === null || !isFinite(v)) return "–";
  return v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function signed(v: number, decimals = 0): string {
  const s = fmtNum(Math.abs(v), decimals);
  return v > 0 ? `+${s}` : v < 0 ? `−${s}` : s;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export const DOMAIN_COLOR: Record<Domain | "strain" | "sleep" | "energy" | "recovery", string> = {
  energy: "#eb9d18",
  recovery: "#13b57e",
  sleep: "#7b68ee",
  strain: "#ef5a45",
  nutrition: "#2298cf",
};

export const DOMAIN_LABEL: Record<string, string> = {
  energy: "Energy",
  recovery: "Recovery",
  sleep: "Sleep",
  strain: "Strain",
  nutrition: "Nutrition",
};

/** 0..100 score -> qualitative color. */
export function scoreColor(score: number): string {
  if (score >= 67) return "#38d39f";
  if (score >= 34) return "#f6b83b";
  return "#ff6b6b";
}
