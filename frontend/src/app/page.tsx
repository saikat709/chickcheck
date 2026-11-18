"use client";

import React, { useState, useEffect } from "react";
import { LiveStats, AlertEvent, AnimalTrack, fetchLiveStats, fetchAnimals, fetchEvents } from "@/lib/api";
import { HeroVideoPanel } from "@/components/HeroVideoPanel";
import { MetricsCards } from "@/components/MetricsCards";
import { FlockCharts } from "@/components/FlockCharts";
import { LiveAlertsFeed } from "@/components/LiveAlertsFeed";
import { AnimalTable } from "@/components/AnimalTable";
import { AnimalDetailDrawer } from "@/components/AnimalDetailDrawer";
import { ZoneOccupancyView } from "@/components/ZoneOccupancyView";
import { IncidentGallery } from "@/components/IncidentGallery";
import { EmergencyBanner } from "@/components/EmergencyBanner";
import { PhysicalInspectionModal } from "@/components/PhysicalInspectionModal";
import { BroilerLifecycleBar } from "@/components/BroilerLifecycleBar";
import { soundManager } from "@/lib/soundAlert";
import { useLanguage } from "@/lib/LanguageContext";
import { TrendingUp, Layers, Video, ShieldCheck, Calendar, MapPin, AlertCircle } from "lucide-react";

export default function DashboardPage() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<LiveStats>({
    species: "chicken",
    count: 0,
    active_count: 0,
    idle_count: 0,
    activity_index: 50.0,
    flock_health_score: 100.0,
    dispersion: 0.0,
    crowding_index: 0.0,
    mean_speed_norm: 0.0,
    status: "healthy",
    fps: 0.0,
    timestamp: Date.now() / 1000,
    source_status: "connecting",
  });

  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [animals, setAnimals] = useState<AnimalTrack[]>([]);
  const [selectedAnimalId, setSelectedAnimalId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"analytics" | "birds" | "incidents">("analytics");
  const [isPhysicalModalOpen, setIsPhysicalModalOpen] = useState<boolean>(false);

  // Initial data loading
  useEffect(() => {
    let cancelled = false;

    async function initialLoad() {
      try {
        const [initStats, initEvents, initAnimals] = await Promise.all([
          fetchLiveStats().catch(() => null),
          fetchEvents({ limit: 30 }).catch(() => []),
          fetchAnimals().catch(() => []),
        ]);
        if (!cancelled) {
          if (initStats) setStats(initStats);
          if (initEvents) setEvents(initEvents);
          if (initAnimals) setAnimals(initAnimals);
        }
      } catch (e) {
        console.error("Initial load error:", e);
      }
    }
    initialLoad();

    // Polling animals list every 3s
    const animInterval = setInterval(async () => {
      try {
        const anims = await fetchAnimals();
        if (!cancelled) setAnimals(anims);
      } catch (e) {
        // ignore transient
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(animInterval);
    };
  }, []);

  // Real-time SSE Connection with exponential backoff reconnect
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimeout: any = null;
    let delay = 1000;

    function connect() {
      es = new EventSource("/api/stream/events");

      es.addEventListener("connected", (evt: any) => {
        try {
          const data = JSON.parse(evt.data);
          setStats((prev) => ({ ...prev, ...data, source_status: "live" }));
          delay = 1000;
        } catch (e) {}
      });

      es.addEventListener("metrics_tick", (evt: any) => {
        try {
          const data = JSON.parse(evt.data);
          setStats((prev) => ({ ...prev, ...data }));
        } catch (e) {}
      });

      es.addEventListener("event", (evt: any) => {
        try {
          const newEvt = JSON.parse(evt.data);
          setEvents((prev) => [newEvt, ...prev.slice(0, 49)]);

          // Sound chime trigger for critical incidents
          if (
            newEvt.severity === "critical" ||
            newEvt.alert_type === "panic_movement" ||
            newEvt.alert_type === "immobile_bird_candidate"
          ) {
            soundManager.playCriticalChime();
          }
        } catch (e) {}
      });

      es.onerror = () => {
        setStats((prev) => ({ ...prev, source_status: "reconnecting" }));
        if (es) {
          es.close();
          es = null;
        }
        reconnectTimeout = setTimeout(connect, delay);
        delay = Math.min(15000, delay * 1.5);
      };
    }

    connect();

    return () => {
      if (es) es.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  const handleAcknowledge = (eventId: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.event_id === eventId ? { ...e, acknowledged: true } : e))
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "alert":
        return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30";
      case "watch":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
      default:
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    }
  };

  // Count events with media for badge
  const mediaEventsCount = events.filter((e) => e.snapshot_path || e.clip_path).length;

  // Immobile candidates count
  const immobileCandidatesCount = events.filter(
    (e) => !e.acknowledged && (e.alert_type === "immobile_bird_candidate" || e.alert_type === "fallen_posture")
  ).length;

  return (
    <div className="space-y-6">
      {/* 1. Emergency Callout Banner (Appears when active critical event occurs) */}
      <EmergencyBanner
        events={events}
        onAcknowledge={handleAcknowledge}
        onOpenPhysicalModal={() => setIsPhysicalModalOpen(true)}
      />

      {/* 2. Barn & Batch Status Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <MapPin className="w-4 h-4" />
            </span>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              {t("barn_shed_name", "Shed 01 — Commercial Broiler House (North)")}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 pl-8">
            <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {t("barn_batch_info", "Batch #14 • Age: Day 22 Broiler")}
            </span>
            <span>•</span>
            <span>{t("barn_target_info", "Target Harvest: Day 35")}</span>
          </div>
        </div>

        {/* Global Health Status & Physical Inspection Quick Pill */}
        <div className="flex items-center gap-3">
          {/* Physical Check Pill */}
          <button
            onClick={() => setIsPhysicalModalOpen(true)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
              immobileCandidatesCount > 0
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 animate-pulse hover:bg-amber-500/25"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
            }`}
            title="Inspect flagged immobile bird candidates"
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            <span>{t("physical_check_btn", "Physical Check")}</span>
            {immobileCandidatesCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center">
                {immobileCandidatesCount}
              </span>
            )}
          </button>

          {/* Health Badge */}
          <div
            className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm ${getStatusBadge(
              stats.status
            )}`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>
              {t(`status_${stats.status}` as any, stats.status)} ({Math.round(stats.flock_health_score)}%)
            </span>
          </div>
        </div>
      </div>

      {/* 3. Broiler Lifecycle Progress Bar (Day 1 -> Day 35) */}
      <BroilerLifecycleBar currentDay={22} totalDays={35} />

      {/* 4. Operations Command Deck: Live CCTV Stream (Left 2 cols) & Real-time Alerts Feed (Right 1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <HeroVideoPanel stats={stats} />
        </div>
        <div className="lg:col-span-1">
          <LiveAlertsFeed events={events} onAcknowledge={handleAcknowledge} />
        </div>
      </div>

      {/* 5. Core Flock KPI Strip (Uncertainty Range, Activity, Crowding, FPS) */}
      <MetricsCards stats={stats} />

      {/* 6. Modular Workspace Tabs Navigation */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto pb-1">
          {/* Tab 1: Flock Trends & Barn Zones */}
          <button
            onClick={() => setActiveTab("analytics")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === "analytics"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>{t("tab_flock_analytics", "Flock Trends & Zones")}</span>
          </button>

          {/* Tab 2: Individual Bird Screening */}
          <button
            onClick={() => setActiveTab("birds")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === "birds"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>{t("tab_tracked_birds", "Tracked Birds Screening")}</span>
            <span className="ml-1 px-2 py-0.5 text-[10px] rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {animals.length}
            </span>
          </button>

          {/* Tab 3: Incident Clips & Evidence */}
          <button
            onClick={() => setActiveTab("incidents")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === "incidents"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            }`}
          >
            <Video className="w-4 h-4" />
            <span>{t("tab_incident_archive", "Incident Clips & Evidence")}</span>
            {mediaEventsCount > 0 && (
              <span className="ml-1 px-2 py-0.5 text-[10px] rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30">
                {mediaEventsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 7. Modular Tab Content */}
      <div className="pt-2">
        {/* Tab 1: Flock Trends & Zone Distribution Side-by-Side */}
        {activeTab === "analytics" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <FlockCharts />
            </div>
            <div className="xl:col-span-1">
              <ZoneOccupancyView />
            </div>
          </div>
        )}

        {/* Tab 2: Vetted Tracked Birds Registry */}
        {activeTab === "birds" && (
          <div>
            <AnimalTable animals={animals} onSelectAnimal={(id) => setSelectedAnimalId(id)} />
          </div>
        )}

        {/* Tab 3: Incident Clips & Evidence Gallery */}
        {activeTab === "incidents" && (
          <div>
            <IncidentGallery events={events} />
          </div>
        )}
      </div>

      {/* Modals & Drawers */}
      <AnimalDetailDrawer
        animalId={selectedAnimalId}
        onClose={() => setSelectedAnimalId(null)}
      />

      <PhysicalInspectionModal
        isOpen={isPhysicalModalOpen}
        onClose={() => setIsPhysicalModalOpen(false)}
        events={events}
        onAcknowledge={handleAcknowledge}
      />
    </div>
  );
}
