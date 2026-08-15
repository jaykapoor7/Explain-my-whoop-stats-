import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CURA",
    short_name: "CURA",
    description: "Your body, clearly explained — daily recovery, sleep, strain and energy scores from your wearable, with the patterns behind them.",
    start_url: "/today",
    display: "standalone",
    background_color: "#f4efe4",
    theme_color: "#f4efe4",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.svg", sizes: "180x180", type: "image/svg+xml" },
    ],
  };
}
