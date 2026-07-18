import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", opts ?? { month: "short", day: "numeric" });
}

export function formatDateLong(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function hourLabel(h: number | undefined): string {
  if (h === undefined) return "–";
  const hour = ((h % 24) + 24) % 24;
  const hh = Math.floor(hour);
  const mm = Math.round((hour - hh) * 60);
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
}

export function recoveryColor(recovery: number | undefined): string {
  if (recovery === undefined) return "#898781";
  if (recovery >= 67) return "#0ca30c";
  if (recovery >= 34) return "#fab219";
  return "#d03b3b";
}

export function recoveryLabel(recovery: number | undefined): string {
  if (recovery === undefined) return "No data";
  if (recovery >= 67) return "Green";
  if (recovery >= 34) return "Yellow";
  return "Red";
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
