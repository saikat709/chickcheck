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

export default function DashboardPage() {
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

  return (
    <div className="space-y-6">
      {/* 1. Hero & Alerts Feed Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <HeroVideoPanel stats={stats} />
        </div>
        <div className="lg:col-span-1">
          <LiveAlertsFeed events={events} onAcknowledge={handleAcknowledge} />
        </div>
      </div>

      {/* 2. Key Metrics Cards */}
      <MetricsCards stats={stats} />

      {/* 3. Charts & Heatmap Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <FlockCharts />
        </div>
        <div className="xl:col-span-1">
          <ZoneOccupancyView />
        </div>
      </div>

      {/* 4. Animal Registry Table */}
      <AnimalTable animals={animals} onSelectAnimal={(id) => setSelectedAnimalId(id)} />

      {/* 5. Animal Detail Drawer */}
      <AnimalDetailDrawer
        animalId={selectedAnimalId}
        onClose={() => setSelectedAnimalId(null)}
      />
    </div>
  );
}

