"use client";

import React, { useState } from "react";
import { AlertEvent, submitEventFeedback, acknowledgeEvent } from "@/lib/api";
import { AlertCircle, CheckCircle, XCircle, MapPin, Clock, X, Image as ImageIcon } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface PhysicalInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: AlertEvent[];
  onAcknowledge: (eventId: string) => void;
}

export function PhysicalInspectionModal({
  isOpen,
  onClose,
  events,
  onAcknowledge,
}: PhysicalInspectionModalProps) {
  const { t } = useLanguage();
  const [resolvedIds, setResolvedIds] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  // Filter events for immobile bird candidates or recumbent postures
  const inspectionCandidates = events.filter(
    (e) => e.alert_type === "immobile_bird_candidate" || e.alert_type === "fallen_posture"
  );

  const handleResolve = async (eventId: string, status: "correct" | "false_alarm") => {
    try {
      await submitEventFeedback(eventId, status);
      await acknowledgeEvent(eventId);
      onAcknowledge(eventId);
      setResolvedIds((prev) => ({ ...prev, [eventId]: status }));
    } catch (err) {
      console.error("Resolution error:", err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-amber-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg tracking-tight">
                {t("physical_check_title", "Physical Inspection Required")}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("physical_check_desc", "Stationary plumage blobs flagged for manual barn inspection")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {inspectionCandidates.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto opacity-75" />
              <p className="font-medium text-sm text-slate-600 dark:text-slate-300">
                No immobile bird candidates currently flagged.
              </p>
              <p className="text-xs text-slate-400">
                The plumage blob tracking engine will screen and surface stationary birds here automatically.
              </p>
            </div>
          ) : (
            inspectionCandidates.map((c) => {
              const resolution = resolvedIds[c.event_id];
              return (
                <div
                  key={c.event_id}
                  className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/70 p-4 flex flex-col sm:flex-row items-center gap-4"
                >
                  {/* Cropped Snapshot Evidence */}
                  <div className="w-full sm:w-36 h-28 bg-slate-900 rounded-xl overflow-hidden relative shrink-0 flex items-center justify-center">
                    {c.snapshot_path ? (
                      <img
                        src={`/${c.snapshot_path}`}
                        alt={c.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-slate-600" />
                    )}
                    <span className="absolute bottom-1 right-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/70 text-white">
                      Crop
                    </span>
                  </div>

                  {/* Candidate Details */}
                  <div className="flex-1 space-y-1.5 w-full text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {t(`rule_${c.alert_type}` as any, c.title)}
                      </span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(c.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {c.description}
                    </p>

                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-amber-500" />
                      <span>{t("physical_check_zone", "Zone")}: {c.description.includes("Feeder") ? t("zone_feeder", "Feeder Area") : t("zone_resting", "Resting Area")}</span>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 flex items-center gap-2">
                      {resolution ? (
                        <div className="text-xs font-bold text-emerald-500 flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4" />
                          <span>Resolved ({resolution === "correct" ? "Confirmed" : "Cleared"})</span>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => handleResolve(c.event_id, "correct")}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>{t("physical_check_confirm", "Checked & Removed")}</span>
                          </button>
                          <button
                            onClick={() => handleResolve(c.event_id, "false_alarm")}
                            className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>{t("physical_check_false", "False Signal")}</span>
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
      </div>
    </div>
  );
}
