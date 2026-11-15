"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimalDetail, fetchAnimalDetail } from "@/lib/api";
import { X, Activity, Clock, Navigation, AlertTriangle, ShieldCheck, RefreshCw } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface AnimalDetailDrawerProps {
  animalId: number | null;
  onClose: () => void;
}

export function AnimalDetailDrawer({ animalId, onClose }: AnimalDetailDrawerProps) {
  const [detail, setDetail] = useState<AnimalDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (animalId === null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const d = await fetchAnimalDetail(animalId!);
        if (!cancelled) setDetail(d);
      } catch (e) {
        console.error("Failed to load animal detail:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [animalId]);

  // Render 2D Trail Canvas
  useEffect(() => {
    if (!detail || !canvasRef.current || !detail.trail || detail.trail.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Normalize trail coordinates to canvas size
    const xs = detail.trail.map((p) => p[0]);
    const ys = detail.trail.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const spanX = Math.max(10, maxX - minX);
    const spanY = Math.max(10, maxY - minY);
    const pad = 20;
    const cw = canvas.width - pad * 2;
    const ch = canvas.height - pad * 2;

    const scale = Math.min(cw / spanX, ch / spanY);

    ctx.beginPath();
    ctx.strokeStyle = detail.status === "alert" ? "#ef4444" : detail.status === "watch" ? "#eab308" : "#22c55e";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    detail.trail.forEach((pt, i) => {
      const px = pad + (pt[0] - minX) * scale;
      const py = pad + (pt[1] - minY) * scale;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Draw current head dot
    const last = detail.trail[detail.trail.length - 1];
    const lx = pad + (last[0] - minX) * scale;
    const ly = pad + (last[1] - minY) * scale;
    ctx.beginPath();
    ctx.arc(lx, ly, 6, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  }, [detail]);

  if (animalId === null) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full overflow-y-auto border-l border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 flex flex-col justify-between animate-in slide-in-from-right duration-200">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Animal Profile</span>
              <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Track #{animalId}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {loading || !detail ? (
            <div className="py-20 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-slate-500" />
              <span>Loading telemetry...</span>
            </div>
          ) : (
            <div className="mt-5 space-y-6">
              {/* Status & Health Gauge */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Health Index</span>
                  <span
                    className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full border ${
                      detail.status === "alert"
                        ? "bg-red-500/10 text-red-500 border-red-500/30"
                        : detail.status === "watch"
                        ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                        : "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                    }`}
                  >
                    {detail.status}
                  </span>
                </div>
                <div className="text-3xl font-black">{detail.health_score.toFixed(0)} <span className="text-xs font-normal text-slate-400">/ 100</span></div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      detail.status === "alert"
                        ? "bg-red-500"
                        : detail.status === "watch"
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.max(5, detail.health_score)}%` }}
                  />
                </div>
              </div>

              {/* Kinematic Metrics Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Activity className="w-3.5 h-3.5 text-blue-500" />
                    <span>Speed (norm)</span>
                  </div>
                  <div className="text-lg font-bold mt-1">
                    {detail.last_speed_norm.toFixed(2)} <span className="text-xs font-normal text-slate-400">bl/s</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Idle Time</span>
                  </div>
                  <div className="text-lg font-bold mt-1">
                    {detail.total_idle_seconds.toFixed(0)} <span className="text-xs font-normal text-slate-400">sec</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 col-span-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Navigation className="w-3.5 h-3.5 text-teal-500" />
                    <span>Displacement Traveled</span>
                  </div>
                  <div className="text-lg font-bold mt-1">
                    {Math.round(detail.total_distance_px)} <span className="text-xs font-normal text-slate-400">pixels</span>
                  </div>
                </div>
              </div>

              {/* Motion Trail Canvas */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Observed Motion Trail
                </h4>
                <div className="bg-slate-950 rounded-xl p-2 flex items-center justify-center border border-slate-800">
                  <canvas ref={canvasRef} width={340} height={160} className="w-full h-40" />
                </div>
              </div>

              {/* Recent Speed Series */}
              {detail.speed_history && detail.speed_history.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Recent Speed Profile
                  </h4>
                  <div className="h-28 w-full bg-slate-50 dark:bg-slate-800/60 rounded-xl p-2 border border-slate-200 dark:border-slate-700">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={detail.speed_history}>
                        <Line type="monotone" dataKey="speed_norm" stroke="#3b82f6" strokeWidth={2} dot={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#1e293b", border: "none", borderRadius: "6px", fontSize: "11px" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Incident History */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Incident History ({detail.events.length})
                </h4>
                {detail.events.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">No past anomaly incidents recorded for #{animalId}.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.events.map((e, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs"
                      >
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{e.title}</div>
                        <div className="text-slate-400 text-[11px] mt-0.5">
                          {new Date(e.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-center">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-semibold text-sm transition-colors"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}

