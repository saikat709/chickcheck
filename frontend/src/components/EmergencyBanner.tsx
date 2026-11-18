"use client";

import React from "react";
import { AlertEvent } from "@/lib/api";
import { AlertOctagon, CheckCircle2, MapPin, Clock } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface EmergencyBannerProps {
  events: AlertEvent[];
  onAcknowledge: (eventId: string) => void;
  onOpenPhysicalModal?: () => void;
}

export function EmergencyBanner({ events, onAcknowledge, onOpenPhysicalModal }: EmergencyBannerProps) {
  const { t } = useLanguage();

  // Find the most recent unacknowledged critical alert
  const activeCritical = events.find(
    (e) => !e.acknowledged && (e.severity === "critical" || e.alert_type === "panic_movement" || e.alert_type === "camera_fault")
  );

  if (!activeCritical) return null;

  const isImmobile = activeCritical.alert_type === "immobile_bird_candidate";

  return (
    <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 rounded-2xl p-4 text-white shadow-lg shadow-red-500/20 border border-red-400/30 animate-pulse transition-all">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left: Icon & Alert Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
            <AlertOctagon className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 border border-white/30">
                {t("emergency_callout_title", "Active Urgent Emergency")}
              </span>
              <span className="text-xs text-white/80 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(activeCritical.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <h3 className="font-extrabold text-sm sm:text-base tracking-tight mt-0.5">
              {t(`rule_${activeCritical.alert_type}` as any, activeCritical.title)}
            </h3>
            <p className="text-xs text-white/90 line-clamp-1 mt-0.5">
              {activeCritical.description}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {isImmobile && onOpenPhysicalModal && (
            <button
              onClick={onOpenPhysicalModal}
              className="px-3.5 py-1.5 rounded-xl bg-white text-red-600 text-xs font-bold hover:bg-white/90 transition-all shadow-md flex items-center gap-1.5"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>{t("physical_check_btn", "Physical Check")}</span>
            </button>
          )}

          <button
            onClick={() => onAcknowledge(activeCritical.event_id)}
            className="px-4 py-2 rounded-xl bg-black/30 hover:bg-black/50 text-white text-xs font-bold transition-all border border-white/30 backdrop-blur-sm flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{t("emergency_ack_btn", "Acknowledge Alert")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
