"use client";

import { useId } from "react";

/**
 * CURA mark — a minimalist open "C" ring with a leading dot, echoing the
 * score-ring motif used throughout the app. Gradient recovery→sleep.
 */
export function Logo({ size = 36, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-label="CURA">
      <defs>
        <linearGradient id={`cg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#13b57e" />
          <stop offset="1" stopColor="#7b68ee" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="17" fill={`url(#cg-${id})`} />
      <path
        d="M44.9 47.3 A20 20 0 1 1 44.9 16.7"
        fill="none"
        stroke="#fff"
        strokeWidth="6.4"
        strokeLinecap="round"
      />
      <circle cx="44.9" cy="16.7" r="4.4" fill="#fff" />
    </svg>
  );
}
