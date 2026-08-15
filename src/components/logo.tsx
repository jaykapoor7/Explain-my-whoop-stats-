"use client";

import { useId } from "react";

/**
 * CURA mark — a heartbeat pulse on a warm emerald→teal squircle. Reads
 * instantly as "your vitals", stays crisp down to the 16px favicon.
 */
export function Logo({ size = 36, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-label="CURA">
      <defs>
        <linearGradient id={`cg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#12b47c" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#cg-${id})`} />
      <path
        d="M12 34 H24 L28 24 L34 42 L38 32 H52"
        fill="none"
        stroke="#fff"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
