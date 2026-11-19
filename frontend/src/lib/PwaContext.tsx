"use client";

/**
 * PWA runtime: service-worker registration + update flow, install prompt
 * (Chromium `beforeinstallprompt` and iOS manual instructions), and
 * connectivity state. The service worker only exists in production builds.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaState {
  online: boolean;
  /** Running as an installed app (standalone display mode / iOS home-screen). */
  standalone: boolean;
  /** iOS/iPadOS Safari: no install prompt API, manual Add to Home Screen only. */
  isIOS: boolean;
  /** A native install prompt is available right now (Chromium browsers). */
  canPromptInstall: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
  registration: ServiceWorkerRegistration | null;
  updateReady: boolean;
  applyUpdate: () => void;
}

const Ctx = createContext<PwaState>({
  online: true,
  standalone: false,
  isIOS: false,
  canPromptInstall: false,
  promptInstall: async () => "unavailable",
  registration: null,
  updateReady: false,
  applyUpdate: () => {},
});

function detectIOS() {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports as Mac; touch support disambiguates.
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function detectStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true);
  const [standalone, setStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const installEvent = useRef<BeforeInstallPromptEvent | null>(null);
  const [canPromptInstall, setCanPromptInstall] = useState(false);
  const reloading = useRef(false);

  // Connectivity + platform detection
  useEffect(() => {
    setOnline(navigator.onLine);
    setIsIOS(detectIOS());
    setStandalone(detectStandalone());
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const mq = window.matchMedia?.("(display-mode: standalone)");
    const mqChange = () => setStandalone(detectStandalone());
    mq?.addEventListener?.("change", mqChange);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      mq?.removeEventListener?.("change", mqChange);
    };
  }, []);

  // Install prompt (Chromium)
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // we show our own, less intrusive UI
      installEvent.current = e as BeforeInstallPromptEvent;
      setCanPromptInstall(true);
    };
    const onInstalled = () => {
      installEvent.current = null;
      setCanPromptInstall(false);
      setStandalone(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Service worker registration + update detection (production only)
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    let updateTimer: ReturnType<typeof setInterval> | null = null;

    const watch = (reg: ServiceWorkerRegistration) => {
      // A waiting worker + an existing controller means "new version ready".
      if (reg.waiting && navigator.serviceWorker.controller) setUpdateReady(true);
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        sw?.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) setUpdateReady(true);
        });
      });
    };

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        if (cancelled) return;
        setRegistration(reg);
        watch(reg);
        // Look for new deployments every 30 min and whenever the app regains focus.
        updateTimer = setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") reg.update().catch(() => {});
        });
      })
      .catch((err) => console.warn("Service worker registration failed:", err));

    const onControllerChange = () => {
      if (reloading.current) return;
      reloading.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      cancelled = true;
      if (updateTimer) clearInterval(updateTimer);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    const waiting = registration?.waiting;
    if (waiting) waiting.postMessage({ type: "SKIP_WAITING" });
    else window.location.reload();
  }, [registration]);

  const promptInstall = useCallback(async () => {
    const e = installEvent.current;
    if (!e) return "unavailable" as const;
    await e.prompt();
    const { outcome } = await e.userChoice;
    installEvent.current = null; // a prompt event can only be used once
    setCanPromptInstall(false);
    return outcome;
  }, []);

  return (
    <Ctx.Provider value={{ online, standalone, isIOS, canPromptInstall, promptInstall, registration, updateReady, applyUpdate }}>
      {children}
    </Ctx.Provider>
  );
}

export const usePwa = () => useContext(Ctx);

/** Run `fn` on an interval, skipping ticks while the tab is hidden (saves battery & data). */
export function useVisibleInterval(fn: () => void, ms: number, deps: React.DependencyList = []) {
  const saved = useRef(fn);
  saved.current = fn;
  useEffect(() => {
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") saved.current();
    }, ms);
    const onVisible = () => document.visibilityState === "visible" && saved.current();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, ...deps]);
}
