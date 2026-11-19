/// <reference lib="webworker" />
/**
 * ChickCheck service worker (built by @serwist/next → public/sw.js).
 *
 * Caching policy — real-time monitoring must never be served stale:
 *   /api/*, /data/*        NetworkOnly  (stats, SSE, MJPEG video, evidence, config) — never cached
 *   /_next/static/*        precache + CacheFirst (content-hashed, immutable)
 *   icons/images/textures  StaleWhileRevalidate
 *   page navigations       NetworkFirst (5 s) → cached shell → /offline fallback
 */
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, CacheableResponsePlugin, ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist, StaleWhileRevalidate } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const PAGES_CACHE = "cc-pages";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // Wait for the operator to accept the update (see PwaProvider) — no surprise reloads mid-shift.
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    {
      // Live data, streams, evidence media and settings: always from the network.
      matcher: ({ url, sameOrigin }) => sameOrigin && (url.pathname.startsWith("/api/") || url.pathname.startsWith("/data/")),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ request, url, sameOrigin }) => sameOrigin && request.mode === "navigate" && !url.pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        cacheName: PAGES_CACHE,
        networkTimeoutSeconds: 5,
        plugins: [
          new CacheableResponsePlugin({ statuses: [200] }),
          new ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 7 * 24 * 60 * 60 }),
        ],
      }),
    },
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({
        cacheName: "cc-next-static",
        plugins: [new ExpirationPlugin({ maxEntries: 256, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && /^\/(icons|images|textures)\/|^\/favicon\.svg$/.test(url.pathname),
      handler: new StaleWhileRevalidate({
        cacheName: "cc-static-assets",
        plugins: [new ExpirationPlugin({ maxEntries: 48, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
  ],
  fallbacks: {
    entries: [{ url: "/offline", matcher: ({ request }) => request.destination === "document" }],
  },
});

// The client posts SKIP_WAITING when the operator taps "Reload to update".
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

// A new build means new chunk hashes: drop cached page shells so they can't reference deleted chunks.
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.delete(PAGES_CACHE));
});

// ── Web push ──────────────────────────────────────────────────────────────
interface PushPayload {
  title?: string;
  body?: string;
  tag?: string;
  url?: string;
  severity?: string;
  timestamp?: string;
}

self.addEventListener("push", (event) => {
  let data: PushPayload = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() };
  }
  const options: NotificationOptions & { renotify?: boolean; timestamp?: number } = {
    body: data.body,
    // Same tag (the alert's event_id) replaces instead of stacking duplicates.
    tag: data.tag || "chickcheck",
    renotify: data.severity === "critical",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    requireInteraction: data.severity === "critical",
    timestamp: data.timestamp ? Date.parse(data.timestamp) : Date.now(),
    data: { url: data.url || "/events?status=open" },
  };
  event.waitUntil(self.registration.showNotification(data.title || "ChickCheck alert", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/events", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if (new URL(c.url).origin === self.location.origin) {
          await c.focus();
          return (c as WindowClient).navigate(target);
        }
      }
      return self.clients.openWindow(target);
    })()
  );
});

serwist.addEventListeners();
