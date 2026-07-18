import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        base: {
          950: "#0d0d0d",
          900: "#141414",
          850: "#1a1a19",
          800: "#202020",
          750: "#262626",
          700: "#2c2c2a",
          600: "#383835",
          400: "#898781",
          300: "#a8a69f",
          200: "#c3c2b7",
          100: "#e7e6df",
          50: "#f9f9f7",
        },
        accent: {
          DEFAULT: "#3987e5",
          soft: "#6da7ec",
          deep: "#1c5cab",
        },
        series: {
          blue: "#3987e5",
          green: "#3fae3f",
          magenta: "#d55181",
          yellow: "#c98500",
          aqua: "#199e70",
          orange: "#d95926",
          violet: "#9085e9",
          red: "#e66767",
        },
        status: {
          good: "#0ca30c",
          warning: "#fab219",
          serious: "#ec835a",
          critical: "#d03b3b",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        glow: "0 0 60px -12px rgba(57, 135, 229, 0.35)",
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.5)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease forwards",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
