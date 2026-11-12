import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/shell";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const display = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });

/** Absolute origin for link-preview image URLs (og:image needs a full URL).
 * Vercel preview builds use their own URL automatically; this covers
 * production and local builds. */
function siteUrl(): URL {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  for (const candidate of [process.env.APP_URL, prod && `https://${prod}`]) {
    if (!candidate) continue;
    try {
      return new URL(candidate);
    } catch {
      // ignore a malformed value and try the next one
    }
  }
  return new URL("https://explain-my-whoop-stats.vercel.app");
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: "CURA", template: "%s · CURA" },
  description:
    "CURA turns Fitbit and Google Health data into daily recovery, sleep, strain and energy scores, with plain-English explanations and personal patterns.",
  openGraph: { siteName: "CURA", type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#f4efe4",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${display.variable} font-sans`}>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
