"use client";

import React, { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { fetchHistory, HistoryPoint } from "@/lib/api";
import { TrendingUp, RefreshCw } from "lucide-react";

export function FlockCharts() {
  const [range, setRange] = useState("1h");
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      try {
        const res = await fetchHistory(range);
        if (!cancelled) {
          setPoints(res.points || []);
        }
      } catch (e) {
        console.error("Error loading historical trends:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    const interval = setInterval(loadData, 10000); // refresh every 10s
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [range]);

  const formattedData = points.map((p) => {
    const d = new Date(p.timestamp);
    const timeLabel =
      range === "7d"
        ? `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:00`
        : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(
            d.getSeconds()
          ).padStart(2, "0")}`;

    return {
      time: timeLabel,
      activity: Math.round(p.activity_index),
      count: p.count,
      health: Math.round(p.flock_health_score),
    };
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          <h2 className="font-bold text-base sm:text-lg">Flock Trends & Behavioral Dynamics</h2>
        </div>

        {/* Range Selector Buttons */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          {["1h", "24h", "7d"].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase transition-all ${
                range === r
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading && points.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Loading historical charts...</span>
        </div>
      ) : formattedData.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400">
          <p className="text-sm">Collecting telemetry points...</p>
          <span className="text-xs text-slate-500 mt-1">Real-time metrics will plot here continuously</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Activity Index & Animal Count */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Flock Activity Index (0-100) & Animal Count
            </h3>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="cntGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "none",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Area
                    type="monotone"
                    dataKey="activity"
                    name="Activity Index"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#actGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Tracked Count"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#cntGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Flock Health Score Trend */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Flock Health Score Index Trend
            </h3>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "none",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Line
                    type="monotone"
                    dataKey="health"
                    name="Health Score"
                    stroke="#22c55e"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

