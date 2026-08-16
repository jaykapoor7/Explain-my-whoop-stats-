/**
 * CURA mark — the app's own multi-metric dial: green / amber / purple arcs
 * (recovery · energy · sleep) around a dark core, on a warm cream tile. Uses
 * the exact palette of the score rings throughout the app.
 */
export function Logo({ size = 36, className }: { size?: number; className?: string }) {
  const c = 2 * Math.PI * 19; // ring circumference
  const seg = 0.28 * c;
  const Arc = ({ color, start }: { color: string; start: number }) => (
    <circle
      cx="32" cy="32" r="19" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
      strokeDasharray={`${seg} ${c}`} strokeDashoffset={-start * c} transform="rotate(-90 32 32)"
    />
  );
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-label="CURA">
      <rect width="64" height="64" rx="18" fill="#fdfaf3" stroke="rgba(0,0,0,0.07)" />
      <circle cx="32" cy="32" r="19" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="7" />
      <Arc color="#13b57e" start={0} />
      <Arc color="#eb9d18" start={0.34} />
      <Arc color="#7b68ee" start={0.68} />
      <circle cx="32" cy="32" r="3.4" fill="#211c14" />
    </svg>
  );
}
