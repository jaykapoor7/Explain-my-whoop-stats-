/**
 * CURA mark — a single open ring (a "C" and the score-ring motif at once) in
 * ink, with one green leading-edge dot as the sole accent. Deliberately
 * monochrome + one colour, rather than a rainbow of arcs, so it reads as a
 * considered brandmark instead of a generic multi-gradient app icon.
 */
export function Logo({ size = 36, className, plain = false }: { size?: number; className?: string; plain?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-label="CURA">
      {!plain && <rect width="64" height="64" rx="18" fill="#fdfaf3" stroke="rgba(59,46,20,0.08)" />}
      {/* Open ring forming a "C", gap facing right. */}
      <path d="M46.5 19.8 A19 19 0 1 0 46.5 44.2" fill="none" stroke="#211c14" strokeWidth="6.5" strokeLinecap="round" />
      {/* The single accent: a leading-edge dot, echoing the score rings. */}
      <circle cx="46.5" cy="19.8" r="4.1" fill="#13b57e" />
    </svg>
  );
}
