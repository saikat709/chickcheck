"use client";

import React from "react";
import { Calendar, Scale, Thermometer, Info } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface BroilerLifecycleBarProps {
  currentDay?: number;
  totalDays?: number;
}

export function BroilerLifecycleBar({ currentDay = 22, totalDays = 35 }: BroilerLifecycleBarProps) {
  const { t } = useLanguage();

  const progressPct = Math.min(100, Math.max(0, (currentDay / totalDays) * 100));

  // Determine stage
  let stageName = t("broiler_phase_finisher", "Finisher Phase");
  let targetTemp = "21 - 23°C";
  let targetWeight = "1.85 kg";

  if (currentDay <= 7) {
    stageName = "Brooding Phase (ব্রুডিং পর্যায়)";
    targetTemp = "31 - 33°C";
    targetWeight = "180 g";
  } else if (currentDay <= 14) {
    stageName = "Starter Phase (স্টার্টার পর্যায়)";
    targetTemp = "27 - 29°C";
    targetWeight = "450 g";
  } else if (currentDay <= 28) {
    stageName = "Grower Phase (গ্রোয়ার পর্যায়)";
    targetTemp = "23 - 25°C";
    targetWeight = "1.35 kg";
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
      {/* Top Details */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
              {t("broiler_day_label", `Day ${currentDay} of ${totalDays}`)}
            </span>
            <span className="ml-2 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-semibold text-[10px]">
              {stageName}
            </span>
          </div>
        </div>

        {/* Targets */}
        <div className="flex items-center gap-4 text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-slate-400" />
            <span>{t("broiler_target_weight", `Target Weight: ${targetWeight}`)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Thermometer className="w-3.5 h-3.5 text-slate-400" />
            <span>{t("broiler_target_temp", `Target Ambient: ${targetTemp}`)}</span>
          </div>
        </div>
      </div>

      {/* Visual Progress Bar */}
      <div className="space-y-1.5">
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700/60">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Milestones */}
        <div className="flex justify-between text-[10px] text-slate-400 font-medium px-0.5">
          <span>Day 1 (Brooding)</span>
          <span>Day 7 (Starter)</span>
          <span>Day 14 (Grower)</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">Day 22 (Current)</span>
          <span>Day 35 (Harvest)</span>
        </div>
      </div>
    </div>
  );
}
