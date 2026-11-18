"use client";

import React, { useState } from "react";
import { AlertEvent, acknowledgeEvent, submitEventFeedback } from "@/lib/api";
import { Bell, Check, Play, Image as ImageIcon, X, AlertTriangle, AlertOctagon, Info, ThumbsUp, ThumbsDown } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface LiveAlertsFeedProps {
  events: AlertEvent[];
  onAcknowledge?: (eventId: string) => void;
}

export function LiveAlertsFeed({ events, onAcknowledge }: LiveAlertsFeedProps) {
  const { t } = useLanguage();
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [ackingIds, setAckingIds] = useState<Set<string>>(new Set());
  const [feedbackState, setFeedbackState] = useState<Record<string, string>>({});

  const handleAck = async (evt: AlertEvent) => {
    setAckingIds((prev) => new Set(prev).add(evt.event_id));
    try {
      await acknowledgeEvent(evt.event_id);
      if (onAcknowledge) onAcknowledge(evt.event_id);
    } catch (e) {
      console.error("Failed to acknowledge event:", e);
    } finally {
      setAckingIds((prev) => {
        const next = new Set(prev);
        next.delete(evt.event_id);
        return next;
      });
    }
  };

  const handleFeedback = async (evt: AlertEvent, feedback: "correct" | "false_alarm") => {
    try {
      await submitEventFeedback(evt.event_id, feedback);
      setFeedbackState((prev) => ({ ...prev, [evt.event_id]: feedback }));
    } catch (e) {
      console.error("Failed to submit feedback:", e);
    }
  };

  const getSeverityStyle = (sev: string) => {
    switch (sev.toLowerCase()) {
      case "critical":
        return {
          badge: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
          icon: AlertOctagon,
        };
      case "warning":
        return {
          badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
          icon: AlertTriangle,
        };
      default:
        return {
          badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
          icon: Info,
        };
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-emerald-600" />
          <h3 className="font-bold text-sm sm:text-base">{t("alerts_feed_title", "Real-Time Anomaly Alerts")}</h3>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
          {events.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[460px] pr-1">
        {events.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">
            <Check className="w-8 h-8 mx-auto mb-2 text-emerald-500/60" />
            <p>{t("alerts_feed_empty", "No active flock anomalies detected.")}</p>
          </div>
        ) : (
          events.map((evt) => {
            const sevStyle = getSeverityStyle(evt.severity);
            const SevIcon = sevStyle.icon;
            const isAcking = ackingIds.has(evt.event_id);
            const currentFb = feedbackState[evt.event_id] || evt.feedback;

            return (
              <div
                key={evt.event_id || evt.id}
                className={`p-3 rounded-xl border transition-all text-sm ${
                  evt.acknowledged
                    ? "bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60"
                    : "bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700/80 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold border uppercase ${sevStyle.badge}`}
                    >
                      <SevIcon className="w-3 h-3" />
                      {evt.severity}
                    </span>
                    {evt.animal_id !== null && evt.animal_id !== undefined && (
                      <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        #{evt.animal_id}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      {new Date(evt.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>

                  {/* Acknowledge Button */}
                  {!evt.acknowledged ? (
                    <button
                      onClick={() => handleAck(evt)}
                      disabled={isAcking}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 transition-colors"
                      title="Acknowledge alert"
                    >
                      {isAcking ? "..." : t("alert_ack_button", "Ack")}
                    </button>
                  ) : (
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> {t("alert_acked", "Acked")}
                    </span>
                  )}
                </div>

                <div className="mt-2 font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                  {evt.title}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">
                  {evt.description}
                </p>

                {/* Evidence Attachments & Operator Feedback Loop */}
                <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                  <div className="flex items-center gap-3">
                    {evt.snapshot_path && (
                      <button
                        onClick={() => setSelectedSnapshot(`/data/${evt.snapshot_path}`)}
                        className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium hover:underline"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Snapshot</span>
                      </button>
                    )}
                    {evt.clip_path && (
                      <button
                        onClick={() => setSelectedClip(`/data/${evt.clip_path}`)}
                        className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium hover:underline"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Clip</span>
                      </button>
                    )}
                  </div>

                  {/* Feedback Action Buttons */}
                  <div className="flex items-center gap-1.5">
                    {currentFb ? (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                        ✓ {currentFb === "correct" ? t("alert_feedback_correct", "Correct") : t("alert_feedback_false", "False Alarm")}
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleFeedback(evt, "correct")}
                          className="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                          title="Verify as true anomaly"
                        >
                          <ThumbsUp className="w-3 h-3" />
                          {t("alert_feedback_correct", "Correct")}
                        </button>
                        <button
                          onClick={() => handleFeedback(evt, "false_alarm")}
                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 text-[11px] font-medium flex items-center gap-1 transition-colors"
                          title="Report false alarm"
                        >
                          <ThumbsDown className="w-3 h-3" />
                          {t("alert_feedback_false", "False Alarm")}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Snapshot Modal */}
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
              <img src={selectedSnapshot} alt="Alert Snapshot" className="w-full max-h-[80vh] object-contain rounded-xl" />
            </div>
          </div>
        </div>
      )}

      {/* Video Clip Modal */}
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
              <h4 className="text-white font-bold text-sm mb-3">10-Second Incident Playback</h4>
              <video src={selectedClip} controls autoPlay className="w-full rounded-xl bg-black max-h-[70vh]" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

