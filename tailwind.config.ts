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
        ink: {
          950: "#08090c",
          900: "#0c0e12",
          875: "#101319",
          850: "#14171e",
          800: "#181c24",
          750: "#1e232c",
          700: "#262c37",
          600: "#333a47",
          500: "#4a5361",
          400: "#6b7482",
          300: "#8b93a1",
          200: "#aeb5c1",
          100: "#d5d9e0",
          50: "#eef0f4",
        },
        // Domain accents
        energy: { DEFAULT: "#f6b83b", soft: "#fbd07a", dim: "#7a5c1c" },
        recovery: { DEFAULT: "#38d39f", soft: "#7ce7c4", dim: "#1a6a52" },
        sleep: { DEFAULT: "#8b8cff", soft: "#b6b7ff", dim: "#45466f" },
        strain: { DEFAULT: "#ff7a5c", soft: "#ffb09b", dim: "#7a3626" },
        nutrition: { DEFAULT: "#5cc8ff", soft: "#a3e0ff", dim: "#24576f" },
        // Status
        good: "#38d39f",
        warn: "#f6b83b",
        bad: "#ff6b6b",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      borderRadius: { xl2: "1.25rem" },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 10px 30px -18px rgba(0,0,0,0.7)",
        lift: "0 1px 0 0 rgba(255,255,255,0.06) inset, 0 18px 44px -22px rgba(0,0,0,0.8)",
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
