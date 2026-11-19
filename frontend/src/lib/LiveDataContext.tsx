"use client";

/**
 * One shared real-time connection for the whole app.
 * Previously the SSE stream lived inside the dashboard page, so the nav could
 * not show real stream status or alert counts. Now every page reads from here.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  AlertEvent,
  HealthStatus,
  LiveStats,
  acknowledgeEvent,
  fetchEvents,
  fetchHealth,
  fetchLiveStats,
  submitEventFeedback,
} from "./api";
import { usePwa } from "./PwaContext";

const SNAPSHOT_KEY = "chickcheck_last_stats";
const SNAPSHOT_EVERY_MS = 15000;

export type ConnectionState = "connecting" | "live" | "reconnecting";

interface LiveData {
  stats: LiveStats;
  /** True once real stats have arrived (vs. placeholder defaults). */
  hasStats: boolean;
  connection: ConnectionState;
  /** Data is streaming right now (online, SSE connected, not a cached snapshot). */
  isLive: boolean;
  /** Epoch ms when metrics were last received from the server (or the cached snapshot's time). */
  lastReceivedAt: number | null;
  /** Stats shown come from the on-device snapshot, not the server. */
  fromCache: boolean;
  /** Force an immediate reconnect of the stream and status polling. */
  reconnect: () => void;
  health: HealthStatus | null;
  healthError: boolean;
  /** Most recent events (initial fetch + SSE pushes). */
  events: AlertEvent[];
  eventsLoaded: boolean;
  /** Initial event fetch failed — never present that as "no alerts". */
  eventsError: boolean;
  /** Unacknowledged alert count (server-side, capped at OPEN_CAP). */
  openAlerts: number;
  openAlertsCapped: boolean;
  /** False until the open-alert count has been fetched successfully. */
  openAlertsKnown: boolean;
  acknowledge: (eventId: string) => Promise<void>;
  sendFeedback: (eventId: string, fb: "correct" | "false_alarm") => Promise<void>;
  /** Merge an event update coming from another list (e.g. Alerts page). */
  patchEvent: (eventId: string, patch: Partial<AlertEvent>) => void;
}

const OPEN_CAP = 200;

const DEFAULT_STATS: LiveStats = {
  species: "chicken",
  count: 0,
  active_count: 0,
  idle_count: 0,
  activity_index: 0,
  flock_health_score: 100,
  dispersion: 0,
  crowding_index: 0,
  mean_speed_norm: 0,
  status: "healthy",
  fps: 0,
  timestamp: 0,
  source_status: "connecting",
};

const Ctx = createContext<LiveData | null>(null);

export function LiveDataProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<LiveStats>(DEFAULT_STATS);
  const [hasStats, setHasStats] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [eventsError, setEventsError] = useState(false);
  const [openAlertsKnown, setOpenAlertsKnown] = useState(false);
  const [openAlerts, setOpenAlerts] = useState(0);
  const [openAlertsCapped, setOpenAlertsCapped] = useState(false);
  const seenIds = useRef<Set<string>>(new Set());
  const [lastReceivedAt, setLastReceivedAt] = useState<number | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [reconnectKey, setReconnectKey] = useState(0);
  const lastSnapshot = useRef(0);
  const { online } = usePwa();

  /** Accept fresh server metrics: mark live and persist a throttled, non-sensitive snapshot. */
  const acceptStats = useCallback((data: Partial<LiveStats>) => {
    setStats((p) => {
      const next = { ...p, ...data };
      const now = Date.now();
      if (now - lastSnapshot.current > SNAPSHOT_EVERY_MS) {
        lastSnapshot.current = now;
        try {
          localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ savedAt: now, stats: next }));
        } catch {}
      }
      return next;
    });
    setHasStats(true);
    setFromCache(false);
    setLastReceivedAt(Date.now());
  }, []);

  // Restore the last snapshot so an offline launch shows *labelled* last-known values.
  // Runs on mount, before any network response can arrive; fresh data replaces it.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (!raw) return;
      const snap = JSON.parse(raw) as { savedAt: number; stats: LiveStats };
      if (!snap?.stats || !snap.savedAt) return;
      setStats({ ...DEFAULT_STATS, ...snap.stats });
      setHasStats(true);
      setFromCache(true);
      setLastReceivedAt(snap.savedAt);
    } catch {}
  }, []);

  // Coming back online: reconnect immediately instead of waiting for back-off.
  const firstOnline = useRef(true);
  useEffect(() => {
    if (firstOnline.current) {
      firstOnline.current = false;
      return;
    }
    if (online) setReconnectKey((k) => k + 1);
    else setConnection("reconnecting");
  }, [online]);

  const reconnect = useCallback(() => setReconnectKey((k) => k + 1), []);

  // Initial loads + periodic refresh of things SSE does not push
  useEffect(() => {
    let cancelled = false;

    fetchLiveStats()
      .then((s) => {
        if (!cancelled) acceptStats(s);
      })
      .catch(() => {});

    fetchEvents({ limit: 50 })
      .then((evs) => {
        if (cancelled) return;
        evs.forEach((e) => seenIds.current.add(e.event_id));
        setEvents(evs);
        setEventsError(false);
      })
      .catch(() => !cancelled && setEventsError(true))
      .finally(() => !cancelled && setEventsLoaded(true));

    const loadOpen = () =>
      fetchEvents({ acknowledged: false, limit: OPEN_CAP })
        .then((evs) => {
          if (cancelled) return;
          setOpenAlerts(evs.length);
          setOpenAlertsCapped(evs.length >= OPEN_CAP);
          setOpenAlertsKnown(true);
        })
        .catch(() => !cancelled && setOpenAlertsKnown(false));

    const loadHealth = () =>
      fetchHealth()
        .then((h) => {
          if (cancelled) return;
          setHealth(h);
          setHealthError(false);
        })
        .catch(() => !cancelled && setHealthError(true));

    loadOpen();
    loadHealth();
    // Skip polls while the tab is hidden (battery/data); refresh immediately on return.
    const visible = () => document.visibilityState === "visible";
    const openIv = setInterval(() => visible() && loadOpen(), 30000);
    const healthIv = setInterval(() => visible() && loadHealth(), 10000);
    const onVisible = () => {
      if (visible()) {
        loadOpen();
        loadHealth();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(openIv);
      clearInterval(healthIv);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [acceptStats, reconnectKey]);

  // SSE with exponential back-off (same protocol as before)
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let delay = 1000;
    let closed = false;

    const connect = () => {
      es = new EventSource("/api/stream/events");

      es.addEventListener("connected", (evt: MessageEvent) => {
        try {
          acceptStats(JSON.parse(evt.data));
        } catch {}
        setConnection("live");
        delay = 1000;
      });

      es.addEventListener("metrics_tick", (evt: MessageEvent) => {
        try {
          acceptStats(JSON.parse(evt.data));
          setConnection("live");
        } catch {}
      });

      es.addEventListener("event", (evt: MessageEvent) => {
        try {
          const e: AlertEvent = JSON.parse(evt.data);
          if (seenIds.current.has(e.event_id)) return;
          seenIds.current.add(e.event_id);
          setEvents((p) => [e, ...p].slice(0, 50));
          if (!e.acknowledged) setOpenAlerts((n) => n + 1);
        } catch {}
      });

      es.onerror = () => {
        if (closed) return;
        setConnection("reconnecting");
        es?.close();
        es = null;
        reconnectTimer = setTimeout(connect, delay);
        delay = Math.min(15000, delay * 1.5);
      };
    };

    connect();
    return () => {
      closed = true;
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [acceptStats, reconnectKey]);

  const patchEvent = useCallback((eventId: string, patch: Partial<AlertEvent>) => {
    setEvents((p) => p.map((e) => (e.event_id === eventId ? { ...e, ...patch } : e)));
  }, []);

  const acknowledge = useCallback(
    async (eventId: string) => {
      await acknowledgeEvent(eventId);
      patchEvent(eventId, { acknowledged: true, acknowledged_at: new Date().toISOString() });
      setOpenAlerts((n) => Math.max(0, n - 1));
    },
    [patchEvent]
  );

  const sendFeedback = useCallback(
    async (eventId: string, fb: "correct" | "false_alarm") => {
      await submitEventFeedback(eventId, fb);
      patchEvent(eventId, { feedback: fb });
    },
    [patchEvent]
  );

  return (
    <Ctx.Provider
      value={{
        stats,
        hasStats,
        connection,
        isLive: online && connection === "live" && !fromCache,
        lastReceivedAt,
        fromCache,
        reconnect,
        health,
        healthError,
        events,
        eventsLoaded,
        eventsError,
        openAlerts,
        openAlertsKnown,
        openAlertsCapped,
        acknowledge,
        sendFeedback,
        patchEvent,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useLiveData(): LiveData {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLiveData must be used inside LiveDataProvider");
  return v;
}

/** Derived camera state: combines SSE connection, pipeline source and frame age. */
export function useCameraState(): "live" | "stale" | "offline" | "connecting" {
  const { connection, stats, health, healthError } = useLiveData();
  const { online } = usePwa();
  if (!online) return "offline";
  if (healthError && connection !== "live") return "offline";
  if (connection === "connecting" && !health) return "connecting";
  if (stats.source_status === "stopped" || health?.source_status === "stopped") return "offline";
  if (health && health.last_frame_age_s > 5) return "stale";
  if (connection === "reconnecting") return "stale";
  return "live";
}

/** True when we have never received stats and the backend is unreachable. */
export function useDataUnavailable(): boolean {
  const { hasStats } = useLiveData();
  const camera = useCameraState();
  return !hasStats && camera === "offline";
}
