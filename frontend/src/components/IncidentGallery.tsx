"use client";

import React, { useState } from "react";
import { AlertEvent, submitEventFeedback } from "@/lib/api";
import { Play, Image as ImageIcon, CheckCircle, XCircle, Clock, Video, X } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface IncidentGalleryProps {
  events: AlertEvent[];
}

export function IncidentGallery({ events }: IncidentGalleryProps) {
  const { t } = useLanguage();
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
  const [feedbackStates, setFeedbackStates] = useState<Record<string, string>>({});

  // Filter events that have snapshot or clip
  const mediaEvents = events.filter((e) => e.snapshot_path || e.clip_path);

  const handleFeedback = async (eventId: string, feedback: "correct" | "false_alarm") => {
    try {
      await submitEventFeedback(eventId, feedback);
      setFeedbackStates((prev) => ({ ...prev, [eventId]: feedback }));
    } catch (e) {
      console.error("Feedback submission error:", e);
    }
  };

  const getSeverityBadge = (sev: string) => {
    const s = sev.toLowerCase();
    if (s === "critical") return "bg-red-500/15 text-red-500 border-red-500/30";
    if (s === "warning") return "bg-amber-500/15 text-amber-500 border-amber-500/30";
    return "bg-blue-500/15 text-blue-500 border-blue-500/30";
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-base sm:text-lg flex items-center gap-2">
            <Video className="w-5 h-5 text-emerald-600" />
            {t("tab_incident_archive", "Incident Clips & Evidence")}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("tab_incidents_count", "Recorded Events")}: {mediaEvents.length}
          </p>
        </div>
      </div>

      {mediaEvents.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          {t("tab_incidents_empty", "No incident clips recorded yet.")}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mediaEvents.map((evt) => {
            const hasClip = Boolean(evt.clip_path);
            const hasSnap = Boolean(evt.snapshot_path);
            const userFeedback = feedbackStates[evt.event_id] || evt.feedback;

            return (
              <div
                key={evt.event_id}
                className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden flex flex-col justify-between"
              >
                {/* Media Thumbnail */}
                <div className="relative aspect-video bg-slate-900 flex items-center justify-center overflow-hidden group">
                  {hasSnap ? (
                    <img
                      src={`/${evt.snapshot_path}`}
                      alt={evt.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="text-slate-500 flex flex-col items-center gap-1">
                      <ImageIcon className="w-8 h-8" />
                      <span className="text-xs">No Snapshot</span>
                    </div>
                  )}

                  {/* Play Clip Overlay Button */}
                  {hasClip && (
                    <button
                      onClick={() => setSelectedClip(`/${evt.clip_path}`)}
                      className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-emerald-600/90 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110"
                      title={t("btn_watch_clip", "Watch Clip")}
                    >
                      <Play className="w-5 h-5 ml-0.5 fill-current" />
                    </button>
                  )}

                  {/* Expand Snapshot Button */}
                  {hasSnap && (
                    <button
                      onClick={() => setSelectedSnapshot(`/${evt.snapshot_path}`)}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white text-xs backdrop-blur-sm"
                      title={t("btn_view_snapshot", "View Snapshot")}
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Severity Badge */}
                  <span
                    className={`absolute bottom-2 left-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border backdrop-blur-md ${getSeverityBadge(
                      evt.severity
                    )}`}
                  >
                    {evt.severity}
                  </span>
                </div>

                {/* Details */}
                <div className="p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-100 line-clamp-1">
                      {t(`rule_${evt.alert_type}` as any, evt.title)}
                    </h4>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                    {evt.description}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700/60">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>

                    {/* Operator Feedback Buttons */}
                    <div className="flex items-center gap-1.5">
                      {userFeedback ? (
                        <span className="text-[10px] font-semibold text-emerald-500">
                          {userFeedback === "correct" ? "✓ Valid" : "✗ False"}
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => handleFeedback(evt.event_id, "correct")}
                            className="p-1 rounded hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] flex items-center gap-0.5"
                            title="Verify as Correct"
                          >
                            <CheckCircle className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleFeedback(evt.event_id, "false_alarm")}
                            className="p-1 rounded hover:bg-red-500/20 text-red-600 dark:text-red-400 text-[10px] flex items-center gap-0.5"
                            title="Mark as False Alarm"
                          >
                            <XCircle className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Snapshot Modal */}
      {selectedSnapshot && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedSnapshot(null)}
        >
          <div className="relative max-w-4xl w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
            <button
              onClick={() => setSelectedSnapshot(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={selectedSnapshot} alt="Snapshot Preview" className="w-full h-auto object-contain max-h-[80vh]" />
          </div>
        </div>
      )}

      {/* Video Clip Modal */}
      {selectedClip && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedClip(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedClip(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <video src={selectedClip} controls autoPlay className="w-full h-auto max-h-[80vh]" />
          </div>
        </div>
      )}
    </div>
  );
}
