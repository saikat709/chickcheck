"use client";

import React, { useState } from "react";
import { AnimalTrack } from "@/lib/api";
import { Activity, Clock, ChevronRight, Filter } from "lucide-react";

interface AnimalTableProps {
  animals: AnimalTrack[];
  onSelectAnimal: (id: number) => void;
}

export function AnimalTable({ animals, onSelectAnimal }: AnimalTableProps) {
  const [filter, setFilter] = useState<"all" | "active" | "alert">("all");

  const filtered = animals.filter((a) => {
    if (filter === "active") return a.active;
    if (filter === "alert") return a.status === "alert" || a.status === "watch";
    return true;
  });

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "alert") {
      return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30";
    } else if (s === "watch") {
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
    }
    return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-sm">
      {/* Table Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-bold text-base sm:text-lg">Tracked Livestock Registry</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Persistent kinematic tracking states and health screening indexes
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          {(["all", "active", "alert"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                filter === mode
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm">
          No livestock matching filter &quot;{filter}&quot;.
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase text-slate-500 font-semibold border-y border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Track ID</th>
                <th className="py-3 px-4">Species</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Health Index</th>
                <th className="py-3 px-4">Speed (norm)</th>
                <th className="py-3 px-4">Idle Time</th>
                <th className="py-3 px-4">Active</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((animal) => (
                <tr
                  key={animal.animal_id}
                  onClick={() => onSelectAnimal(animal.animal_id)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                >
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                    #{animal.animal_id}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="capitalize px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {animal.species || "chicken"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${getStatusBadge(
                        animal.status
                      )}`}
                    >
                      {animal.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{animal.health_score.toFixed(0)}</span>
                      <div className="w-16 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            animal.status === "alert"
                              ? "bg-red-500"
                              : animal.status === "watch"
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.max(5, animal.health_score)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-600 dark:text-slate-300">
                    {animal.last_speed_norm.toFixed(2)} bl/s
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                    {animal.total_idle_seconds.toFixed(0)}s
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                        animal.active ? "text-emerald-500" : "text-slate-400"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          animal.active ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                        }`}
                      />
                      {animal.active ? "In View" : "Lost / Receded"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-400">
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

