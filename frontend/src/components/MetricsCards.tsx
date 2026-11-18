"use client";

import React from "react";
import { Users, Zap, Layers, Activity } from "lucide-react";
import { LiveStats } from "@/lib/api";
import { useLanguage } from "@/lib/LanguageContext";

interface MetricsCardsProps {
  stats: LiveStats;
}

export function MetricsCards({ stats }: MetricsCardsProps) {
  const { t } = useLanguage();

  const countValue =
    stats.density_count !== undefined && stats.density_count > 0
      ? `${stats.density_count} ± ${stats.uncertainty || 0}`
      : `${stats.count}`;

  const methodLabel = stats.density_method ? ` · ${stats.density_method.replace(/_/g, " ")}` : "";
  const countSubvalue = `${stats.active_count} ${t("metric_active_chicks", "active")} · ${stats.idle_count} ${t("metric_idle_chicks", "idle")}${methodLabel}`;

  const cards = [
    {
      label: t("metric_tracked_count", "Estimated Flock Count"),
      value: countValue,
      subvalue: countSubvalue,
      icon: Users,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      label: t("metric_flock_activity", "Whole-Flock Activity"),
      value: `${(stats.optical_flow_activity !== undefined ? stats.optical_flow_activity : stats.activity_index).toFixed(1)}%`,
      subvalue: "Farnebäck motion energy (0-100)",
      icon: Zap,
      color: "text-sky-500",
      bg: "bg-sky-500/10",
      border: "border-sky-500/20",
    },
    {
      label: t("metric_crowding_index", "Crowding & Huddle Index"),
      value: `${(stats.crowding_index * 100).toFixed(1)}%`,
      subvalue: stats.crowding_index > 0.3 ? "Elevated huddle density" : "Normal flock distribution",
      icon: Layers,
      color: stats.crowding_index > 0.3 ? "text-amber-500" : "text-indigo-500",
      bg: stats.crowding_index > 0.3 ? "bg-amber-500/10" : "bg-indigo-500/10",
      border: stats.crowding_index > 0.3 ? "border-amber-500/30" : "border-indigo-500/20",
    },
    {
      label: t("metric_flock_health", "Flock Health Index"),
      value: `${Math.round(stats.flock_health_score || 100)}%`,
      subvalue: stats.status ? `${stats.status.toUpperCase()}` : "Healthy",
      icon: Activity,
      color: stats.flock_health_score < 70 ? "text-rose-500" : "text-emerald-500",
      bg: stats.flock_health_score < 70 ? "bg-rose-500/10" : "bg-emerald-500/10",
      border: stats.flock_health_score < 70 ? "border-rose-500/30" : "border-emerald-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div
            key={i}
            className={`p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border ${card.border} shadow-sm flex flex-col justify-between transition-all hover:shadow-md`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                {card.label}
              </span>
              <div className={`p-2 rounded-xl shrink-0 ${card.bg}`}>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                {card.value}
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 truncate">
                {card.subvalue}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
