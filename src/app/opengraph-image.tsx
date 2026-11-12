import { ImageResponse } from "next/og";

// Link-preview card (og:image; Next also reuses it for twitter:image). Rendered
// once at build time in the site's cream / green palette.
export const alt = "CURA: daily recovery, sleep, strain and energy scores from your Fitbit data, each one explained.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const HEADLINE = "Your Fitbit data, explained.";
const SUB = "Four daily scores, each measured against your own baseline and broken down into what raised or lowered it.";
const SCORES: [string, string][] = [
  ["Recovery", "#13b57e"],
  ["Sleep", "#7b68ee"],
  ["Strain", "#ef5a45"],
  ["Energy", "#eb9d18"],
];

/** Fetch a subset of a Google font as TTF. Returns null on any failure so the
 * card still renders with the built-in font. */
async function googleFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(text)}`)
    ).text();
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
    if (!src) return null;
    const res = await fetch(src[1]);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/** The CURA mark (same geometry as src/components/logo.tsx). */
function Mark({ size: s }: { size: number }) {
  const c = 2 * Math.PI * 19;
  const seg = 0.28 * c;
  const arcs: [string, number][] = [["#13b57e", 0], ["#eb9d18", 0.34], ["#7b68ee", 0.68]];
  return (
    <svg width={s} height={s} viewBox="0 0 64 64">
      <rect x="0.5" y="0.5" width="63" height="63" rx="18" fill="#fdfaf3" stroke="rgba(0,0,0,0.07)" />
      <circle cx="32" cy="32" r="19" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="7" />
      {arcs.map(([color, start]) => (
        <circle
          key={color}
          cx="32" cy="32" r="19" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${seg} ${c}`} strokeDashoffset={-start * c} transform="rotate(-90 32 32)"
        />
      ))}
      <circle cx="32" cy="32" r="3.4" fill="#211c14" />
    </svg>
  );
}

export default async function OpengraphImage() {
  const [display, body] = await Promise.all([
    googleFont("Space+Grotesk", 700, `CURA${HEADLINE}`),
    googleFont("Inter", 500, `${SUB}${SCORES.map(([n]) => n).join("")}`),
  ]);
  const fonts = [
    ...(display ? [{ name: "Display", data: display, weight: 700 as const, style: "normal" as const }] : []),
    ...(body ? [{ name: "Body", data: body, weight: 500 as const, style: "normal" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#f4efe4",
          fontFamily: "Body",
          color: "#211c14",
        }}
      >
        {/* Soft recovery-green and sleep-violet glows, as on the landing hero. */}
        <div
          style={{
            position: "absolute", left: -260, top: -320, width: 980, height: 760, borderRadius: 9999,
            background: "radial-gradient(closest-side, rgba(19,181,126,0.22), rgba(19,181,126,0))",
          }}
        />
        <div
          style={{
            position: "absolute", right: -220, bottom: -300, width: 760, height: 640, borderRadius: 9999,
            background: "radial-gradient(closest-side, rgba(123,104,238,0.14), rgba(123,104,238,0))",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 760, padding: "64px 0 64px 72px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Mark size={60} />
            <div style={{ fontFamily: "Display", fontSize: 36, fontWeight: 700, letterSpacing: 6 }}>CURA</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: "Display", fontSize: 84, fontWeight: 700, lineHeight: 1.02, letterSpacing: -3 }}>
              {HEADLINE}
            </div>
            <div style={{ marginTop: 26, fontSize: 28, lineHeight: 1.4, color: "#655b49" }}>{SUB}</div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            {SCORES.map(([name, color]) => (
              <div
                key={name}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", borderRadius: 9999,
                  background: "#fdfaf3", border: "1px solid rgba(0,0,0,0.08)", fontSize: 22, color: "#484031",
                }}
              >
                <div style={{ width: 10, height: 10, borderRadius: 9999, background: color }} />
                {name}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", paddingRight: 40 }}>
          <div
            style={{
              display: "flex", borderRadius: 96,
              boxShadow: "0 40px 80px -30px rgba(59,46,20,0.45), 0 2px 6px rgba(59,46,20,0.1)",
            }}
          >
            <Mark size={330} />
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined }
  );
}
