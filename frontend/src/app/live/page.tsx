"use client";

import React from "react";
import { Layers, Square, Wind, MapPin, Flame, Route, CircleDot, Radar } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useLiveData, useCameraState } from "@/lib/LiveDataContext";
import { activityValue, countDisplay } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Switch, Segmented } from "@/components/ui/Controls";
import { StatusPill, LiveDot } from "@/components/ui/Badges";
import { Skeleton } from "@/components/ui/States";
import { VideoStream, useOverlayPrefs, BoxShape, OverlayPrefs } from "@/components/monitoring/VideoStream";
import { DensityGrid, ZoneOccupancy } from "@/components/monitoring/Spatial";

function OverlayToggle({
  id,
  icon: Icon,
  label,
  checked,
  onChange,
}: {
  id: string;
  icon: typeof Square;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm font-medium text-ink-2">
        <Icon className="h-4 w-4 text-ink-3" />
        {label}
      </label>
      <Switch id={id} checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function Readout({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="text-[11px] font-medium text-ink-3">{label}</div>
      <div className="mt-0.5 text-lg font-bold leading-tight text-ink tabular">{value}</div>
      {hint && <div className="mt-0.5 truncate text-[11px] text-ink-3">{hint}</div>}
    </div>
  );
}

export default function LivePage() {
  const { t, num } = useLanguage();
  const { stats, hasStats, health } = useLiveData();
  const camera = useCameraState();
  const { prefs, update, ready } = useOverlayPrefs();
  const count = countDisplay(stats);

  const toggles: { id: keyof OverlayPrefs; icon: typeof Square; label: string }[] = [
    { id: "show_boxes", icon: Square, label: t("video_boxes_toggle") },
    { id: "show_flow", icon: Wind, label: t("video_flow_toggle") },
    { id: "show_zones", icon: MapPin, label: t("video_zones_toggle") },
    { id: "heatmap", icon: Flame, label: t("video_heatmap_toggle") },
    { id: "show_trails", icon: Route, label: t("video_trails") },
    { id: "show_clusters", icon: CircleDot, label: t("video_clusters") },
  ];

  const speciesCounts = Object.entries(stats.species_counts || {});

  return (
    <div>
      <PageHeader
        title={t("page_live_title")}
        subtitle={t("page_live_sub")}
        actions={hasStats ? <StatusPill status={stats.status} size="md" /> : undefined}
      />

      <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-12">
        <div className="space-y-4 sm:space-y-5 xl:col-span-8">
          <Card className="overflow-hidden">
            <VideoStream prefs={prefs} ready={ready} autoStart />
            {/* Camera status strip */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line px-4 py-2.5 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                <LiveDot state={camera === "live" ? "live" : camera === "offline" ? "down" : "pending"} />
                {t("camera_label")} 1 · {camera === "live" ? t("status_live") : camera === "connecting" ? t("status_connecting") : camera === "stale" ? t("status_reconnecting") : t("status_offline")}
              </span>
              {health && (
                <span className="text-ink-3">{health.source_type === "network_stream" ? t("health_network") : t("health_file")}</span>
              )}
              <span className="text-ink-3 tabular">{num(stats.fps, 1)} fps</span>
              <span className="hidden text-ink-3 md:inline">{t("camera_single_note")}</span>
            </div>
          </Card>

          {/* Live readouts — directly under the video so eyes travel less */}
          <Card>
            <CardHeader icon={Radar} title={t("metric_tracked_count")} subtitle={stats.density_regime === "dense_crowd" ? t("regime_dense") : t("regime_sparse")} />
            <CardBody>
              {!hasStats ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-[68px]" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Readout
                    label={t("metric_tracked_count")}
                    value={
                      <>
                        {num(Number(count.value))}
                        {count.uncertainty !== null && <span className="text-sm font-semibold text-ink-3"> ± {num(count.uncertainty)}</span>}
                      </>
                    }
                    hint={
                      stats.count_min !== undefined && stats.count_min !== null && stats.count_max
                        ? `${t("metric_uncertainty")}: ${num(stats.count_min)}–${num(stats.count_max)}`
                        : stats.density_method?.replace(/_/g, " ")
                    }
                  />
                  <Readout label={t("metric_flock_activity")} value={num(activityValue(stats), 1)} hint={t("metric_activity_desc")} />
                  <Readout label={t("metric_crowding_index")} value={num((stats.crowding_index || 0) * 100)} hint={`/ ${num(100)}`} />
                  <Readout label={t("metric_flock_health")} value={num(stats.flock_health_score)} hint={`/ ${num(100)}`} />
                  <Readout label={`${t("metric_active_chicks")} / ${t("metric_idle_chicks")}`} value={`${num(stats.active_count)} / ${num(stats.idle_count)}`} />
                  <Readout label={t("metric_max_cluster")} value={num(stats.max_cluster_size ?? 0)} />
                  <Readout label={t("metric_immobile")} value={num(stats.immobile_candidates_count ?? 0)} />
                  <Readout label={t("metric_pipeline_fps")} value={num(stats.fps, 1)} hint={stats.is_enhanced ? t("video_enhanced") : undefined} />
                </div>
              )}
              {speciesCounts.length > 1 && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-2">
                  {speciesCounts.map(([sp, n]) => (
                    <span key={sp} className="rounded-md bg-surface-2 px-2 py-1 capitalize ring-1 ring-inset ring-line">
                      {sp}: <b className="tabular">{num(n)}</b>
                    </span>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4 self-start sm:space-y-5 xl:col-span-4">
          <Card>
            <CardHeader icon={Layers} title={t("video_overlays")} />
            <CardBody className="pt-2">
              <div className="divide-y divide-line">
                {toggles.map((tg) => (
                  <OverlayToggle
                    key={tg.id}
                    id={`ov-${tg.id}`}
                    icon={tg.icon}
                    label={tg.label}
                    checked={Boolean(prefs[tg.id])}
                    onChange={(v) => update({ [tg.id]: v } as Partial<OverlayPrefs>)}
                  />
                ))}
              </div>
              <div className="mt-3 border-t border-line pt-3">
                <div className="label">{t("video_shape_toggle")}</div>
                <div className="overflow-x-auto">
                  <Segmented<BoxShape>
                    value={prefs.box_shape}
                    onChange={(v) => update({ box_shape: v })}
                    ariaLabel={t("video_shape_toggle")}
                    options={[
                      { value: "box", label: t("video_shape_box") },
                      { value: "corners", label: t("video_shape_corners") },
                      { value: "solid", label: t("video_shape_solid") },
                      { value: "ellipse", label: t("video_shape_ellipse") },
                      { value: "reticle", label: t("video_shape_reticle") },
                    ]}
                  />
                </div>
              </div>
            </CardBody>
          </Card>
          <ZoneOccupancy />
          <DensityGrid />
        </div>
      </div>
    </div>
  );
}
