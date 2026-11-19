import withSerwistInit from "@serwist/next";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

// Revision for the precached offline page changes whenever its source changes.
const OFFLINE_SRC = "./src/app/offline/page.tsx";
const offlineRevision = existsSync(OFFLINE_SRC)
  ? createHash("md5").update(readFileSync(OFFLINE_SRC)).digest("hex").slice(0, 12)
  : String(Date.now());

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // The service worker is production-only: in `next dev` it would cache hot-reload chunks.
  disable: process.env.NODE_ENV !== "production",
  // Registered by our own client code so updates can wait for the operator's consent.
  register: false,
  reloadOnOnline: false,
  cacheOnNavigation: false,
  additionalPrecacheEntries: [{ url: "/offline", revision: offlineRevision }],
  // Never precache the server-only build manifests or source maps.
  exclude: [/\.map$/, /^manifest.*\.js$/, /middleware-manifest\.json$/],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  output: "standalone",
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8001";
    return [
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
      { source: "/data/:path*", destination: `${backendUrl}/data/:path*` },
    ];
  },
  async headers() {
    return [
      {
        // The service worker must always be revalidated so updates are picked up promptly.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
