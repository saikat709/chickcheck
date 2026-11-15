import React from "react";
import { Users, Zap, Layers, Compass } from "lucide-react";
import { LiveStats } from "@/lib/api";

interface MetricsCardsProps {
  stats: LiveStats;
}

export function MetricsCards({ stats }: MetricsCardsProps) {
  // If multi-species detected, show breakdown
  const speciesBreakdown = stats.species_counts && Object.keys(stats.species_counts).length > 1
    ? Object.entries(stats.species_counts)
        .map(([sp, cnt]) => `${cnt} ${sp}`)
        .join(" · ")
    : null;

  const countSubvalue = speciesBreakdown
    ? `${speciesBreakdown} (${stats.active_count} active)`
    : `${stats.active_count} active · ${stats.idle_count} idle`;

  const cards = [
    {
      label: "Livestock Count",
      value: stats.count,
      subvalue: countSubvalue,
      icon: Users,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Activity Index",
      value: `${stats.activity_index.toFixed(1)}`,
      subvalue: "0 = dormant, 100 = intense",
      icon: Zap,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Crowding Index",
      value: `${(stats.crowding_index * 100).toFixed(1)}%`,
      subvalue: stats.crowding_index > 0.3 ? "Elevated huddle density" : "Normal spacing",
      icon: Layers,
      color: stats.crowding_index > 0.3 ? "text-amber-500" : "text-purple-500",
      bg: stats.crowding_index > 0.3 ? "bg-amber-500/10" : "bg-purple-500/10",
    },
    {
      label: "Flock Dispersion",
      value: `${stats.dispersion.toFixed(1)}x`,
      subvalue: "Normalized body-lengths",
      icon: Compass,
      color: "text-teal-500",
      bg: "bg-teal-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div
            key={i}
            className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {card.label}
              </span>
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black tracking-tight">{card.value}</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {card.subvalue}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

