"use client";

import React, { useState, useEffect } from "react";
import { Grid, RefreshCw } from "lucide-react";

export function ZoneOccupancyView() {
  const [grid, setGrid] = useState<number[][]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/heatmap?format=json");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.grid) {
            setGrid(data.grid);
          }
        }
      } catch (e) {
        console.error("Failed to load zone occupancy:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const iv = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  const getCellColor = (val: number) => {
    if (val <= 0.05) return "bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800";
    if (val <= 0.20) return "bg-emerald-500/20 border-emerald-500/30 text-emerald-400";
    if (val <= 0.50) return "bg-amber-500/30 border-amber-500/40 text-amber-400";
    return "bg-red-500/40 border-red-500/50 text-red-300 font-bold";
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Grid className="w-4 h-4 text-emerald-600" />
          <h3 className="font-bold text-sm sm:text-base">Enclosure Zone Density Map</h3>
        </div>
        <span className="text-xs text-slate-400">16x16 Grid</span>
      </div>

      {loading && grid.length === 0 ? (
        <div className="h-44 flex items-center justify-center text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          <span className="text-xs">Computing spatial density...</span>
        </div>
      ) : grid.length === 0 ? (
        <div className="h-44 flex items-center justify-center text-slate-400 text-xs">
          Accumulating spatial coordinates...
        </div>
      ) : (
        <div className="flex flex-col gap-1 w-full max-w-md mx-auto aspect-video justify-center">
          {grid.slice(0, 8).map((row, rIdx) => (
            <div key={rIdx} className="flex gap-1 flex-1">
              {row.slice(0, 16).map((val, cIdx) => (
                <div
                  key={cIdx}
                  className={`flex-1 rounded-sm border transition-all duration-300 ${getCellColor(val)}`}
                  title={`Zone [${rIdx}, ${cIdx}]: Density ${(val * 100).toFixed(0)}%`}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        <span>Low Traffic</span>
        <div className="flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm bg-slate-200 dark:bg-slate-800" />
          <span className="w-3 h-2 rounded-sm bg-emerald-500/30" />
          <span className="w-3 h-2 rounded-sm bg-amber-500/40" />
          <span className="w-3 h-2 rounded-sm bg-red-500/50" />
        </div>
        <span>High Congestion</span>
      </div>
    </div>
  );
}

