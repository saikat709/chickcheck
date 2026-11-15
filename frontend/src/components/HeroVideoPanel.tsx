"use client";

import React, { useState } from "react";
import { Flame, Maximize2, RefreshCw, Shield, AlertTriangle, AlertOctagon, CheckCircle2, Sparkles, Users, Crosshair, Scan, Square, Circle } from "lucide-react";
import { LiveStats } from "@/lib/api";

interface HeroVideoPanelProps {
  stats: LiveStats;
}

export function HeroVideoPanel({ stats }: HeroVideoPanelProps) {
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showBoxes, setShowBoxes] = useState(true);
  const [boxShape, setBoxShape] = useState<"box" | "ellipse">("box");
  const [streamError, setStreamError] = useState(false);
  const [streamNonce, setStreamNonce] = useState(Date.now());

  const status = (stats.status || "healthy").toLowerCase();

  const getStatusBadge = () => {
    switch (status) {
      case "alert":
        return {
          bg: "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400",
          icon: AlertOctagon,
          label: "ALERT",
          barBg: "bg-red-500",
        };
      case "watch":
        return {
          bg: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
          icon: AlertTriangle,
          label: "WATCH",
          barBg: "bg-amber-500",
        };
      default:
        return {
          bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
          icon: CheckCircle2,
          label: "HEALTHY",
          barBg: "bg-emerald-500",
        };
    }
  };

  const badge = getStatusBadge();
  const StatusIcon = badge.icon;
  const streamUrl = `/api/stream/video?heatmap=${showHeatmap}&show_boxes=${showBoxes}&box_shape=${boxShape}&_t=${streamNonce}`;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      {/* Top Header / Status Bar */}
      <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-sm font-bold tracking-wide ${badge.bg}`}
          >
            <StatusIcon className="w-4 h-4 shrink-0" />
            <span>FLOCK STATUS: {badge.label}</span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Pipeline: <strong>{stats.fps.toFixed(1)} FPS</strong>
          </span>
        </div>

        {/* Health Score Gauge */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Health Index</div>
            <div className="text-xl font-extrabold tracking-tight">
              {stats.flock_health_score.toFixed(0)} <span className="text-xs font-normal text-slate-400">/100</span>
            </div>
          </div>
          <div className="w-16 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${badge.barBg}`}
              style={{ width: `${Math.max(5, Math.min(100, stats.flock_health_score))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Video Viewport Container */}
      <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden">
        {streamError ? (
          <div className="text-center p-6 text-slate-400">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-slate-500" />
            <p className="font-semibold text-sm">Connecting to video pipeline stream...</p>
            <button
              onClick={() => {
                setStreamError(false);
                setStreamNonce(Date.now());
              }}
              className="mt-3 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <img
            src={streamUrl}
            alt="ChickCheck Annotated Livestock Stream"
            onError={() => setStreamError(true)}
            className="w-full h-full object-contain"
          />
        )}

        {/* Video Overlay Controls */}
        <div className="absolute bottom-3 right-3 flex flex-wrap items-center gap-2">
          {/* Tracking Boxes & ID Toggle */}
          <button
            onClick={() => {
              setShowBoxes(!showBoxes);
              setStreamNonce(Date.now());
            }}
            title="Toggle entity bounding boxes and tracking ID numbers"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-md flex items-center gap-1.5 transition-all shadow-md ${
              showBoxes
                ? "bg-emerald-600/90 text-white border border-emerald-400/40"
                : "bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-white/10"
            }`}
          >
            <Square className="w-3.5 h-3.5" />
            <span>Boxes & IDs {showBoxes ? "ON" : "OFF"}</span>
          </button>

          {/* Shape Style Selector */}
          {showBoxes && (
            <div className="flex items-center rounded-lg bg-slate-900/85 backdrop-blur-md border border-white/10 p-0.5 text-xs">
              {(
                [
                  { id: "box", label: "Box", icon: Square },
                  { id: "ellipse", label: "Ellipse", icon: Circle },
                ] as const
              ).map((mode) => {
                const Icon = mode.icon;
                const isSelected = boxShape === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => {
                      setBoxShape(mode.id);
                      setStreamNonce(Date.now());
                    }}
                    title={`Tracking shape: ${mode.label}`}
                    className={`px-2 py-1 rounded flex items-center gap-1 font-medium transition-all ${
                      isSelected
                        ? "bg-slate-700 text-white shadow-sm font-semibold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span className="hidden sm:inline">{mode.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Heatmap Toggle */}
          <button
            onClick={() => {
              setShowHeatmap(!showHeatmap);
              setStreamNonce(Date.now());
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-md flex items-center gap-1.5 transition-all shadow-md ${
              showHeatmap
                ? "bg-amber-600 text-white"
                : "bg-slate-900/80 text-slate-200 hover:bg-slate-800/90 border border-white/10"
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Heatmap {showHeatmap ? "ON" : "OFF"}</span>
          </button>
        </div>

        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2">
          <div className="bg-slate-950/75 backdrop-blur-md text-white text-xs font-medium px-2.5 py-1 rounded-md border border-white/10 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{stats.count} Animals Detected</span>
          </div>

          {stats.is_enhanced && (
            <div className="bg-sky-950/80 backdrop-blur-md text-sky-300 text-xs font-semibold px-2.5 py-1 rounded-md border border-sky-500/30 flex items-center gap-1 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>Low-Res Enhanced (CLAHE)</span>
            </div>
          )}

          {stats.max_cluster_size && stats.max_cluster_size >= 3 ? (
            <div className="bg-amber-950/80 backdrop-blur-md text-amber-300 text-xs font-semibold px-2.5 py-1 rounded-md border border-amber-500/30 flex items-center gap-1 shadow-sm">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span>Huddle Cluster: {stats.max_cluster_size}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

