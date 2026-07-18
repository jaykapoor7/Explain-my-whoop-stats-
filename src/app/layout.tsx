import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "Recovery Intelligence — Understand your body, not just your metrics",
    template: "%s · Recovery Intelligence",
  },
  description:
    "Upload your wearable data and let AI uncover patterns, answer questions, explain trends, and reveal insights hidden inside months of health data.",
};

export const viewport: Viewport = {
  themeColor: "#0d0d0d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans min-h-screen bg-base-950 text-white`}>
        {children}
      </body>
    </html>
  );
}
