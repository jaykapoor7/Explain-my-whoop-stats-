import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Health OS",
    short_name: "Health OS",
    description: "Your personal Health OS — scores, explanations and patterns from your Fitbit, nutrition, medication, journal and planner.",
    start_url: "/today",
    display: "standalone",
    background_color: "#f4efe4",
    theme_color: "#f4efe4",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
