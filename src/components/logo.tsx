"use client";

import { useId } from "react";

/**
 * CURA mark — a confident "C" ring cradling a single centred dot: the app's
 * score-ring motif (a ring with your value at its core) compressed into a
 * monogram. Warm emerald→indigo squircle with a soft top-left highlight.
 */
export function Logo({ size = 36, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-label="CURA">
      <defs>
        <linearGradient id={`cg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#12b47c" />
          <stop offset="0.55" stopColor="#3f8fd6" />
          <stop offset="1" stopColor="#7b5cf0" />
        </linearGradient>
        <radialGradient id={`cs-${id}`} cx="0.28" cy="0.24" r="0.9">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#cg-${id})`} />
      <rect width="64" height="64" rx="18" fill={`url(#cs-${id})`} />
      {/* open C, thick with rounded terminals — a letter, not a spinner */}
      <path
        d="M46.4 45 A19 19 0 1 1 46.4 19"
        fill="none"
        stroke="#fff"
        strokeWidth="8"
        strokeLinecap="round"
      />
      {/* the core: your value at the centre of the ring */}
      <circle cx="33.5" cy="32" r="4.3" fill="#fff" />
    </svg>
  );
}
