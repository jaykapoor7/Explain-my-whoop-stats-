import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/shell";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: { default: "Health OS", template: "%s · Health OS" },
  description:
    "An open-source personal Health OS: scores, explanations, and personal patterns from your wearable, nutrition, medication, journal and planner.",
};

export const viewport: Viewport = {
  themeColor: "#08090c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans`}>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
