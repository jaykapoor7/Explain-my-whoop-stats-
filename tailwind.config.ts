import type { Config } from "tailwindcss";

/**
 * Health OS design tokens. Calm, premium, dark-first. A near-black canvas with
 * layered surfaces and one semantic accent per health domain.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Warm cream light palette. Higher number = lighter surface, lower =
        // darker text (inverted from the old dark scale so existing classes work).
        ink: {
          950: "#f4efe4", // page background (warm cream)
          900: "#fdfaf3", // raised card surface (near-white warm)
          875: "#fffefb", // input surface (brightest)
          850: "#f7f2e8", // alt panel
          800: "#efe9db", // hover surface
          750: "#e7dfce", // stronger hover
          700: "#dcd2be", // borders
          600: "#c8bba2", // strong borders
          500: "#a4977f", // faint text / icons
          400: "#83765f", // muted text
          300: "#655b49", // secondary text
          200: "#484031", // strong secondary
          100: "#332e23", // near-primary text
          50: "#211c14", // primary text (darkest warm)
        },
        // Domain accents — deep, saturated jewel tones that read on cream
        energy: { DEFAULT: "#eb9d18", soft: "#f6c35e", dim: "#8a5e0e" },
        recovery: { DEFAULT: "#13b57e", soft: "#4fd3a4", dim: "#0c6f4e" },
        sleep: { DEFAULT: "#7b68ee", soft: "#a99bf4", dim: "#4b3f9e" },
        strain: { DEFAULT: "#ef5a45", soft: "#f79383", dim: "#a2331f" },
        nutrition: { DEFAULT: "#2298cf", soft: "#6dc0e6", dim: "#175f82" },
        // Status
        good: "#13b57e",
        warn: "#d98324",
        bad: "#e0433f",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: { xl2: "1.25rem" },
      boxShadow: {
        // Warm-toned to match the cream theme (the old dark-black shadows read
        // muddy on a light surface). `lift` is the genuine-elevation shadow used
        // for hover, CTAs and overlays; `card` is a quieter resting shadow.
        card: "0 1px 0 0 rgba(255,255,255,0.6) inset, 0 4px 10px -6px rgba(59,46,20,0.1)",
        lift: "0 1px 0 0 rgba(255,255,255,0.6) inset, 0 12px 28px -14px rgba(59,46,20,0.28)",
      },
      keyframes: {
        fadeUp: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        fadeUp: "fadeUp 0.5s cubic-bezier(0.21,0.47,0.32,0.98) forwards",
        shimmer: "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [],
};
export default config;
