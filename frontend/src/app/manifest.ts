import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ChickCheck",
    short_name: "ChickCheck",
    description: "AI-powered poultry farm monitoring platform.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "any", // operators rotate to landscape for the live feed
    background_color: "#FAF6EC",
    theme_color: "#163828",
    lang: "en",
    dir: "ltr",
    categories: ["business", "productivity", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Live Monitoring", short_name: "Live", url: "/live", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Open alerts", short_name: "Alerts", url: "/events?status=open", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
