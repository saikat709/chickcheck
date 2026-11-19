import withSerwistInit from "@serwist/next";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Revision for the precached offline page changes whenever its source changes.
const OFFLINE_SRC = "./src/app/offline/page.tsx";
const offlineRevision = existsSync(OFFLINE_SRC)
  ? createHash("md5").update(readFileSync(OFFLINE_SRC)).digest("hex").slice(0, 12)
  : String(Date.now());

// Passing additionalPrecacheEntries replaces Serwist's default public/ glob, so list
// the app-shell assets explicitly: icons, textures, favicon and the phone-size hero.
const fileRev = (f) => createHash("md5").update(readFileSync(f)).digest("hex").slice(0, 12);
const publicShell = ["icons", "textures", "images"]
  .flatMap((dir) => (existsSync(join("public", dir)) ? readdirSync(join("public", dir)).map((f) => `${dir}/${f}`) : []))
  .filter((f) => statSync(join("public", f)).isFile() && f !== "images/shed-hero.jpg") // full-size hero: runtime-cached on desktop only
  .concat(["favicon.svg"])
  .map((f) => ({ url: `/${f}`, revision: fileRev(join("public", f)) }));

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // The service worker is production-only: in `next dev` it would cache hot-reload chunks.
  disable: process.env.NODE_ENV !== "production",
  // Registered by our own client code so updates can wait for the operator's consent.
  register: false,
  reloadOnOnline: false,
  cacheOnNavigation: false,
  additionalPrecacheEntries: [{ url: "/offline", revision: offlineRevision }, ...publicShell],
  // Never precache the server-only build manifests or source maps.
  // Fonts are fetched on demand per unicode-range and runtime-cached (CacheFirst) on first use;
  // precaching every weight/subset would cost ~550 KB of mobile data on install.
  exclude: [/\.map$/, /^manifest.*\.js$/, /middleware-manifest\.json$/, /\.woff2?$/],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Overridable so a test build never clobbers a running `next dev` (both default to .next).
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
