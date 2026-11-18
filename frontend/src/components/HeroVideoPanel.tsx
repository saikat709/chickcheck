"use client";

import React, { useState, useRef } from "react";
import {
  Flame,
  Maximize2,
  RefreshCw,
  Camera,
  Shield,
  AlertTriangle,
  AlertOctagon,
  Sparkles,
  Square,
  Circle,
  Wind,
  MapPin,
  Utensils,
  Droplets,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { LiveStats } from "@/lib/api";
import { useLanguage } from "@/lib/LanguageContext";

interface HeroVideoPanelProps {
  stats: LiveStats;
}

export function HeroVideoPanel({ stats }: HeroVideoPanelProps) {
  const { t } = useLanguage();
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showBoxes, setShowBoxes] = useState(true);
  const [showFlow, setShowFlow] = useState(false);
  const [showZones, setShowZones] = useState(false);
  const [boxShape, setBoxShape] = useState<"box" | "ellipse">("box");
  const [streamError, setStreamError] = useState(false);
  const [streamNonce, setStreamNonce] = useState(Date.now());
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const status = (stats.status || "healthy").toLowerCase();

  const getStatusBadge = () => {
    switch (status) {
      case "alert":
        return {
          bg: "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400",
          icon: AlertOctagon,
          label: t("status_alert", "CRITICAL ALERT"),
          barBg: "bg-red-500",
        };
      case "watch":
        return {
          bg: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
          icon: AlertTriangle,
          label: t("status_watch", "MONITORING"),
          barBg: "bg-amber-500",
        };
      default:
        return {
          bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
          icon: CheckCircle2,
          label: t("status_healthy", "HEALTHY"),
          barBg: "bg-emerald-500",
        };
    }
  };

  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return;
    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen().catch((err) => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const takeSnapshot = () => {
    const a = document.createElement("a");
    a.href = `/api/stream/video?heatmap=${showHeatmap}&show_boxes=${showBoxes}&box_shape=${boxShape}&show_flow=${showFlow}&show_zones=${showZones}&_t=${Date.now()}`;
    a.download = `chickcheck_snapshot_${Date.now()}.jpg`;
    a.target = "_blank";
    a.click();
  };

  const badge = getStatusBadge();
  const StatusIcon = badge.icon;
  const streamUrl = `/api/stream/video?heatmap=${showHeatmap}&show_boxes=${showBoxes}&box_shape=${boxShape}&show_flow=${showFlow}&show_zones=${showZones}&_t=${streamNonce}`;

  const displayedCount =
    stats.density_count !== undefined && stats.density_count > 0
      ? `${stats.density_count} ± ${stats.uncertainty || 0}`
      : `${stats.count}`;

  const feederPct = Math.round(stats.zone_occupancy?.feeder || stats.zone_occupancy?.feeder_zone || 58);
  const drinkerPct = Math.round(stats.zone_occupancy?.drinker || stats.zone_occupancy?.drinker_zone || 42);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden flex flex-col">
      {/* 1. Header Bar: Status & Hardware Telemetry */}
      <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-xl border text-xs font-black uppercase tracking-wider ${badge.bg}`}
          >
            <StatusIcon className="w-3.5 h-3.5" />
            <span>{badge.label}</span>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>CCTV 01</span>
            </span>
            <span>·</span>
            <span>{stats.fps > 0 ? `${stats.fps.toFixed(1)} FPS` : "Live Stream"}</span>
          </div>
        </div>

        {/* Health Score Pill */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {t("metric_flock_health", "Flock Health")}
            </div>
            <div className="text-lg font-black tracking-tight leading-none text-slate-900 dark:text-white">
              {stats.flock_health_score.toFixed(0)}
              <span className="text-xs font-normal text-slate-400">/100</span>
            </div>
          </div>
          <div className="w-14 h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${badge.barBg}`}
              style={{ width: `${Math.max(5, Math.min(100, stats.flock_health_score))}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Uncluttered Video Viewport Container */}
      <div
        ref={videoContainerRef}
        className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden select-none"
      >
        {streamError ? (
          <div className="text-center p-8 text-slate-400 space-y-3">
            <RefreshCw className="w-9 h-9 mx-auto animate-spin text-slate-500" />
            <div>
              <p className="font-bold text-sm text-slate-200">
                {t("video_offline_title", "Video Stream Connecting...")}
              </p>
              <p className="text-xs text-slate-500 mt-1">Connecting to backend video pipeline</p>
            </div>
            <button
              onClick={() => {
                setStreamError(false);
                setStreamNonce(Date.now());
              }}
              className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-md"
            >
              Reconnect Video
            </button>
          </div>
        ) : (
          <img
            src={streamUrl}
            alt="ChickCheck Livestock Vision Stream"
            onError={() => setStreamError(true)}
            className="w-full h-full object-cover"
          />
        )}

        {/* Subtle Top-Left Live Tag */}
        <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
          <div className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[11px] font-bold border border-white/10 flex items-center gap-1.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{displayedCount} {t("nav_dashboard", "Birds Tracked")}</span>
          </div>

          {stats.density_regime && (
            <div className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-slate-200 text-[11px] font-medium border border-white/10 shadow-sm">
              <span>{stats.density_regime === "dense_crowd" ? "Dense Sliced Regime" : "Standard Box Regime"}</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Dedicated Clean Video Toolbar (OUTSIDE the video so it never blocks birds!) */}
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: View Overlays */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Boxes & IDs Toggle */}
          <button
            onClick={() => {
              setShowBoxes(!showBoxes);
              setStreamNonce(Date.now());
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
              showBoxes
                ? "bg-emerald-600 text-white shadow-emerald-600/20"
                : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            <Square className="w-3.5 h-3.5" />
            <span>{t("video_boxes_toggle", "Boxes & IDs")}</span>
          </button>

          {/* Box Shape Toggle */}
          {showBoxes && (
            <button
              onClick={() => {
                setBoxShape(boxShape === "box" ? "ellipse" : "box");
                setStreamNonce(Date.now());
              }}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 flex items-center gap-1"
              title="Toggle Box / Ellipse contour shape"
            >
              {boxShape === "box" ? <Circle className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
              <span className="capitalize">{boxShape}</span>
            </button>
          )}

          {/* Barn Zones Toggle */}
          <button
            onClick={() => {
              setShowZones(!showZones);
              setStreamNonce(Date.now());
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
              showZones
                ? "bg-indigo-600 text-white shadow-indigo-600/20"
                : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>{t("video_zones_toggle", "Barn Zones")}</span>
          </button>

          {/* Motion Flow Vectors Toggle */}
          <button
            onClick={() => {
              setShowFlow(!showFlow);
              setStreamNonce(Date.now());
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
              showFlow
                ? "bg-cyan-600 text-white shadow-cyan-600/20"
                : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            <Wind className="w-3.5 h-3.5" />
            <span>{t("video_flow_toggle", "Motion Flow")}</span>
          </button>

          {/* Density Heatmap Toggle */}
          <button
            onClick={() => {
              setShowHeatmap(!showHeatmap);
              setStreamNonce(Date.now());
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
              showHeatmap
                ? "bg-amber-600 text-white shadow-amber-600/20"
                : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>{t("video_heatmap_toggle", "Heatmap")}</span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={takeSnapshot}
            className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
            title="Download high-resolution snapshot"
          >
            <Camera className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
            title="Toggle Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4. Live Feeder & Drinker Line Status Gauges */}
      <div className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-800 bg-slate-100/60 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 text-xs">
        {/* Feeder Gauge */}
        <div className="px-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Utensils className="w-3.5 h-3.5 text-amber-500" />
              {t("feeder_line_quick", "Feed Line Occupancy")}
            </span>
            <span className="font-extrabold text-slate-900 dark:text-white">{feederPct}%</span>
          </div>
          <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(5, feederPct))}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>{t("status_active_feeding", "Active Feeding")}</span>
            <span className="text-emerald-500 font-bold">Normal Rhythm</span>
          </div>
        </div>

        {/* Drinker Gauge */}
        <div className="px-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-cyan-500" />
              {t("drinker_line_quick", "Water Line Flow")}
            </span>
            <span className="font-extrabold text-slate-900 dark:text-white">{drinkerPct}%</span>
          </div>
          <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-teal-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(5, drinkerPct))}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>{t("status_normal_drinking", "Normal Drinking")}</span>
            <span className="text-cyan-500 font-bold">Uninterrupted</span>
          </div>
        </div>
      </div>
    </div>
  );
}
