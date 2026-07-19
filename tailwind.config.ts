import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Luminous indigo scale — page chrome and text inks
        base: {
          950: "#0d1030",
          900: "#121540",
          850: "#181c4d",
          800: "#1e2358",
          750: "#252b66",
          700: "#2e3573",
          600: "#3d4487",
          400: "#8b91c7",
          300: "#a9aeda",
          200: "#c9cdef",
          100: "#e4e6fa",
          50: "#f4f5ff",
        },
        accent: {
          DEFAULT: "#7c6bff",
          soft: "#a29bff",
          deep: "#5946e8",
        },
        vivid: {
          violet: "#7c6bff",
          cyan: "#2dd4ee",
          pink: "#fb7bb8",
          lime: "#a3e635",
          amber: "#fbbf24",
          coral: "#fb8a67",
        },
        series: {
          blue: "#4d9fff",
          green: "#34d399",
          magenta: "#f472b6",
          yellow: "#fbbf24",
          aqua: "#2dd4ee",
          orange: "#fb8a67",
          violet: "#a78bfa",
          red: "#fb7185",
        },
        status: {
          good: "#34d399",
          warning: "#fbbf24",
          serious: "#fb8a67",
          critical: "#fb7185",
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
        glow: "0 0 70px -12px rgba(124, 107, 255, 0.55)",
        "glow-cyan": "0 0 60px -14px rgba(45, 212, 238, 0.5)",
        "glow-pink": "0 0 60px -14px rgba(251, 123, 184, 0.45)",
        card: "0 1px 0 0 rgba(255,255,255,0.06) inset, 0 12px 32px -16px rgba(6, 8, 40, 0.8)",
        lift: "0 1px 0 0 rgba(255,255,255,0.08) inset, 0 20px 44px -18px rgba(124, 107, 255, 0.35)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease forwards",
        "gradient-x": "gradientX 6s ease infinite",
        "spin-slow": "spin 14s linear infinite",
        float: "float 7s ease-in-out infinite",
        "float-late": "float 9s ease-in-out 1.5s infinite",
        marquee: "marquee 28s linear infinite",
        "pulse-glow": "pulseGlow 3.2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        gradientX: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-14px)" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.65", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.05)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
