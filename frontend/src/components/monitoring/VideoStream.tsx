"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2, Pause, Play, RefreshCw, Sparkles, VideoOff, WifiOff } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useLiveData } from "@/lib/LiveDataContext";
import { usePwa } from "@/lib/PwaContext";
import { countDisplay, cn } from "@/lib/format";

export type BoxShape = "box" | "corners" | "solid" | "ellipse" | "reticle";

export interface OverlayPrefs {
  show_boxes: boolean;
  box_shape: BoxShape;
  show_flow: boolean;
  show_zones: boolean;
  heatmap: boolean;
  show_trails: boolean;
  show_clusters: boolean;
}

const DEFAULT_PREFS: OverlayPrefs = {
  show_boxes: true,
  box_shape: "box",
  show_flow: false,
  show_zones: false,
  heatmap: false,
  show_trails: false,
  show_clusters: false,
};

const PREFS_KEY = "chickcheck_overlays";

/**
 * Overlay flags are applied server-side to the single annotated stream, so the
 * preview (Overview) and the full view (Live) must request the same set —
 * otherwise opening one page would silently reset the other's toggles.
 */
export function useOverlayPrefs() {
  const [prefs, setPrefs] = useState<OverlayPrefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch {}
    setReady(true);
  }, []);

  const update = useCallback((patch: Partial<OverlayPrefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  return { prefs, update, ready };
}

/** Phones and Data-Saver users should opt in to video (MJPEG is bandwidth-heavy). */
function shouldDeferAutoplay() {
  if (typeof window === "undefined") return true;
  const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData) return true;
  if (conn?.effectiveType && /(^|-)2g|3g/.test(conn.effectiveType)) return true;
  return window.matchMedia("(max-width: 767px)").matches;
}

export function VideoStream({
  prefs,
  ready,
  compact = false,
  autoStart = "auto",
  className,
}: {
  prefs: OverlayPrefs;
  ready: boolean;
  compact?: boolean;
  /** "auto" = start unless on a phone / Data Saver; true = always start. */
  autoStart?: "auto" | boolean;
  className?: string;
}) {
  const { t, num } = useLanguage();
  const { stats } = useLiveData();
  const { online } = usePwa();
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [nonce, setNonce] = useState(() => Date.now());
  const frameRef = useRef<HTMLDivElement>(null);

  // Playback intent vs. environment: the <img> only exists while all allow it,
  // so the MJPEG connection is genuinely closed whenever we are not showing it.
  const [wanted, setWanted] = useState<boolean | null>(null);
  const [hidden, setHidden] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const [pseudoFull, setPseudoFull] = useState(false);
  const [nativeFull, setNativeFull] = useState(false);

  useEffect(() => {
    setWanted(autoStart === true ? true : !shouldDeferAutoplay());
  }, [autoStart]);

  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState === "hidden");
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    const el = frameRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onFs = () => setNativeFull(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Escape closes the in-page fullscreen fallback.
  useEffect(() => {
    if (!pseudoFull) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && setPseudoFull(false);
    window.addEventListener("keydown", h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = prev;
    };
  }, [pseudoFull]);

  // A new URL re-applies overlay flags on the backend and restarts the MJPEG stream.
  const src = useMemo(() => {
    const q = new URLSearchParams({
      heatmap: String(prefs.heatmap),
      show_boxes: String(prefs.show_boxes),
      box_shape: prefs.box_shape,
      show_flow: String(prefs.show_flow),
      show_zones: String(prefs.show_zones),
      show_trails: String(prefs.show_trails),
      show_clusters: String(prefs.show_clusters),
      _t: String(nonce),
    });
    return `/api/stream/video?${q.toString()}`;
  }, [prefs, nonce]);

  const isFull = pseudoFull || nativeFull;
  const active = ready && wanted === true && online && !hidden && (!offscreen || isFull);

  useEffect(() => {
    setError(false);
    setLoaded(false);
  }, [src, active]);

  const retry = () => {
    setError(false);
    setWanted(true);
    setNonce(Date.now());
  };

  const toggleFullscreen = () => {
    if (isFull) {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      setPseudoFull(false);
      return;
    }
    const el = frameRef.current;
    if (el?.requestFullscreen) {
      el.requestFullscreen()
        .then(() => (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock?.("landscape").catch(() => {}))
        .catch(() => setPseudoFull(true));
    } else {
      setPseudoFull(true); // iPhone Safari: no element fullscreen API
    }
  };

  const count = countDisplay(stats);
  const chip = "rounded-lg bg-black/60 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-md";
  const ctrl =
    "grid h-11 w-11 place-items-center rounded-xl bg-black/55 text-white backdrop-blur-md transition hover:bg-black/75 sm:h-9 sm:w-9";

  return (
    <div
      ref={frameRef}
      className={cn(
        "relative w-full overflow-hidden bg-[#0B120E]",
        pseudoFull ? "fixed inset-0 z-[90] flex items-center" : "aspect-video",
        className
      )}
      style={pseudoFull ? { paddingTop: "env(safe-area-inset-top,0px)", paddingBottom: "env(safe-area-inset-bottom,0px)" } : undefined}
    >
      <div className={cn("relative w-full", pseudoFull ? "aspect-video max-h-full" : "h-full")}>
        {!ready || wanted === null ? (
          <div className="skeleton absolute inset-0 rounded-none !bg-[#16211A]" />
        ) : !online ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <WifiOff className="mb-2 h-6 w-6 text-[#A9C2AF]" />
            <p className="text-sm font-semibold text-white">{t("offline_title")}</p>
            {!compact && <p className="mt-1 max-w-sm text-xs text-[#A9C2AF]">{t("offline_desc")}</p>}
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <span className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-white/5 text-[#A9C2AF]">
              <VideoOff className="h-5 w-5" />
            </span>
            <p className="text-sm font-semibold text-white">{t("video_offline_title")}</p>
            {!compact && <p className="mt-1 max-w-sm text-xs text-[#A9C2AF]">{t("video_offline_desc")}</p>}
            <button onClick={retry} className="btn btn-sm mt-4 bg-white/10 text-white hover:bg-white/20">
              <RefreshCw className="h-3.5 w-3.5" />
              {t("video_retry")}
            </button>
          </div>
        ) : !active ? (
          // Stopped: no image request is open. Never shows a frozen frame as if live.
          <button
            onClick={() => setWanted(true)}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center"
            aria-label={t("video_tap_to_start")}
          >
            <span className="grid h-14 w-14 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/20 transition hover:bg-white/20">
              <Play className="ml-0.5 h-6 w-6" />
            </span>
            <span className="text-sm font-semibold text-white">
              {hidden ? t("video_hidden_paused") : wanted ? t("video_paused") : t("video_tap_to_start")}
            </span>
            {!wanted && <span className="max-w-xs text-xs text-[#A9C2AF]">{t("video_data_note")}</span>}
          </button>
        ) : (
          <>
            {!loaded && (
              <div className="absolute inset-0 grid place-items-center">
                <RefreshCw className="h-6 w-6 animate-spin text-[#A9C2AF]" aria-label={t("loading")} />
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={t("video_panel_title")}
              onLoad={() => setLoaded(true)}
              onError={() => setError(true)}
              className="h-full w-full object-contain"
              decoding="async"
            />
          </>
        )}

        {/* HUD */}
        {ready && active && !error && (
          <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap items-center gap-1.5 sm:left-3 sm:top-3">
            <span className={cn(chip, "inline-flex items-center gap-1.5")}>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff4d4d]" />
              LIVE
            </span>
            <span className={cn(chip, "tabular")}>
              {num(Number(count.value))}
              {count.uncertainty !== null && <span className="opacity-70"> ± {num(count.uncertainty)}</span>} {t("metric_birds")}
            </span>
            {!compact && stats.is_enhanced && (
              <span className={cn(chip, "hidden items-center gap-1 text-[#9FD3FF] sm:inline-flex")}>
                <Sparkles className="h-3 w-3" />
                {t("video_enhanced")}
              </span>
            )}
          </div>
        )}

        {/* Controls */}
        {ready && online && !error && (wanted || isFull) && (
          <div className="absolute right-2 top-2 flex gap-1.5 sm:right-3 sm:top-3">
            {!compact && (
              <button
                onClick={() => setWanted((w) => !w)}
                className={ctrl}
                aria-label={wanted ? t("video_pause") : t("video_resume")}
                title={wanted ? t("video_pause") : t("video_resume")}
              >
                {wanted ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
            )}
            {!compact && (
              <button onClick={toggleFullscreen} className={ctrl} aria-label={isFull ? t("video_exit_fullscreen") : t("video_fullscreen")} title={isFull ? t("video_exit_fullscreen") : t("video_fullscreen")}>
                {isFull ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
