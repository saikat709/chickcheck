"use client";

import React, { useState, useEffect } from "react";
import { AlertEvent, fetchEvents, acknowledgeEvent } from "@/lib/api";
import { Bell, Filter, Check, Play, Image as ImageIcon, X, AlertOctagon, AlertTriangle, Info, RefreshCw } from "lucide-react";

export default function EventsPage() {
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [animalFilter, setAnimalFilter] = useState<string>("");
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [pageOffset, setPageOffset] = useState<number>(0);
  const limit = 20;

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await fetchEvents({
        severity: severityFilter || undefined,
        alert_type: typeFilter || undefined,
        animal_id: animalFilter ? parseInt(animalFilter) : undefined,
        limit,
        offset: pageOffset,
      });
      setEvents(data);
    } catch (e) {
      console.error("Error loading events:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [severityFilter, typeFilter, animalFilter, pageOffset]);

  const handleAck = async (eventId: string) => {
    try {
      await acknowledgeEvent(eventId);
      setEvents((prev) =>
        prev.map((e) => (e.event_id === eventId ? { ...e, acknowledged: true } : e))
      );
    } catch (e) {
      console.error("Failed to acknowledge:", e);
    }
  };

  const getSeverityStyle = (sev: string) => {
    switch (sev.toLowerCase()) {
      case "critical":
        return {
          badge: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
          icon: AlertOctagon,
        };
      case "warning":
        return {
          badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
          icon: AlertTriangle,
        };
      default:
        return {
          badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
          icon: Info,
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-emerald-600" />
            Incident & Anomaly Events
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Audit log of behavioral abnormalities, video clips, and snapshot evidence
          </p>
        </div>

        <button
          onClick={loadEvents}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-slate-400 ml-1" />

        {/* Severity */}
        <select
          value={severityFilter}
          onChange={(e) => {
            setSeverityFilter(e.target.value);
            setPageOffset(0);
          }}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>

        {/* Type */}
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPageOffset(0);
          }}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
        >
          <option value="">All Anomaly Types</option>
          <option value="prolonged_inactivity">Prolonged Inactivity</option>
          <option value="sudden_stop">Sudden Stop</option>
          <option value="fallen_posture">Fallen / Posture Shift</option>
          <option value="isolation">Social Isolation</option>
          <option value="panic_movement">Panic Movement</option>
          <option value="crowding_huddling">Crowding / Huddling</option>
          <option value="count_drop">Count Drop</option>
          <option value="low_flock_activity">Low Diurnal Activity</option>
          <option value="limping_gait">Limping / Gait Proxy</option>
          <option value="feeding_deviation">Feeding Deviation</option>
        </select>

        {/* Animal ID */}
        <input
          type="number"
          placeholder="Animal # ID"
          value={animalFilter}
          onChange={(e) => {
            setAnimalFilter(e.target.value);
            setPageOffset(0);
          }}
          className="w-28 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 placeholder:text-slate-400"
        />

        {(severityFilter || typeFilter || animalFilter) && (
          <button
            onClick={() => {
              setSeverityFilter("");
              setTypeFilter("");
              setAnimalFilter("");
              setPageOffset(0);
            }}
            className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white underline ml-auto"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Events Timeline List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-slate-500" />
            <span>Loading events audit log...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <Check className="w-10 h-10 mx-auto mb-2 text-emerald-500/60" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">No events matched query criteria</p>
            <span className="text-xs text-slate-500">Try loosening your filter parameters</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {events.map((evt) => {
              const sev = getSeverityStyle(evt.severity);
              const SevIcon = sev.icon;

              return (
                <div
                  key={evt.event_id || evt.id}
                  className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    evt.acknowledged ? "opacity-60 bg-slate-50/40 dark:bg-slate-900/40" : "hover:bg-slate-50/70 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div className={`p-2 rounded-xl border mt-0.5 shrink-0 ${sev.badge}`}>
                      <SevIcon className="w-4 h-4" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase border ${sev.badge}`}>
                          {evt.severity}
                        </span>
                        {evt.animal_id !== null && evt.animal_id !== undefined && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            Track #{evt.animal_id}
                          </span>
                        )}
                        <span className="text-xs text-slate-400">
                          {new Date(evt.timestamp).toLocaleString()}
                        </span>
                      </div>

                      <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 mt-1">
                        {evt.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                        {evt.description}
                      </p>

                      {/* Evidence Links */}
                      <div className="mt-2.5 flex items-center gap-3">
                        {evt.snapshot_path && (
                          <button
                            onClick={() => setSelectedSnapshot(`/data/${evt.snapshot_path}`)}
                            className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>Snapshot JPEG</span>
                          </button>
                        )}
                        {evt.clip_path && (
                          <button
                            onClick={() => setSelectedClip(`/data/${evt.clip_path}`)}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Play 10s Clip</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Acknowledge Button */}
                  <div className="sm:self-center shrink-0">
                    {!evt.acknowledged ? (
                      <button
                        onClick={() => handleAck(evt.event_id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 transition-colors shadow-sm"
                      >
                        Acknowledge
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <Check className="w-3.5 h-3.5" />
                        <span>Acknowledged</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <button
            onClick={() => setPageOffset(Math.max(0, pageOffset - limit))}
            disabled={pageOffset === 0}
            className="px-3 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-slate-500">
            Showing records {pageOffset + 1} - {pageOffset + events.length}
          </span>
          <button
            onClick={() => setPageOffset(pageOffset + limit)}
            disabled={events.length < limit}
            className="px-3 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {/* Modals */}
      {selectedSnapshot && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
            <button
              onClick={() => setSelectedSnapshot(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-2">
              <img src={selectedSnapshot} alt="Event Snapshot" className="w-full max-h-[80vh] object-contain rounded-xl" />
            </div>
          </div>
        </div>
      )}

      {selectedClip && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-3xl w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
            <button
              onClick={() => setSelectedClip(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-4">
              <h4 className="text-white font-bold text-sm mb-3">10-Second Incident Recording</h4>
              <video src={selectedClip} controls autoPlay className="w-full rounded-xl bg-black max-h-[70vh]" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

