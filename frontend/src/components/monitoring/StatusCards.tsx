"use client";

import React from "react";
import { Thermometer, ServerCog, Camera, Database, Gauge, Clock, Cable } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useLiveData, useCameraState, useDataUnavailable } from "@/lib/LiveDataContext";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { LiveDot } from "@/components/ui/Badges";
import { Skeleton } from "@/components/ui/States";
import { cn, crowdingLevel, timeAgo } from "@/lib/format";

/** Thermal comfort: crowding index + largest cluster + last huddling alert. */
export function ThermalCard() {
  const { t, language, num } = useLanguage();
  const { stats, hasStats, events } = useLiveData();
  const unavailable = useDataUnavailable();
  const ci = stats.crowding_index || 0;
  const level = crowdingLevel(ci);
  const lastHuddle = events.find((e) => e.alert_type === "crowding_huddling");

  const tone = level === "high" ? "crit" : level === "elevated" ? "warn" : "ok";
  const label = level === "high" ? t("thermal_high") : level === "elevated" ? t("thermal_elevated") : t("thermal_normal");

  return (
    <Card className="h-full">
      <CardHeader icon={Thermometer} title={t("thermal_title")} subtitle={t("metric_crowding_index")} />
      <CardBody>
        {unavailable ? (
          <div className="rounded-xl bg-crit-soft p-3 text-xs font-semibold text-crit">{t("health_unreachable")}</div>
        ) : !hasStats ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            <div className="flex items-end justify-between gap-3">
              <div className="tabular">
                <span className="text-3xl font-extrabold tracking-tight text-ink">{num(ci * 100)}</span>
                <span className="ml-1 text-sm font-semibold text-ink-3">/ {num(100)}</span>
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
                  tone === "ok" && "bg-ok-soft text-ok ring-ok/25",
                  tone === "warn" && "bg-warn-soft text-warn ring-warn/30",
                  tone === "crit" && "bg-crit-soft text-crit ring-crit/30"
                )}
              >
                {label}
              </span>
            </div>
            {/* Scale with thresholds at 30 / 50 */}
            <div className="relative mt-3 h-2 w-full rounded-full bg-surface-3">
              <div
                className={cn("h-full rounded-full transition-all duration-700", tone === "ok" ? "bg-ok" : tone === "warn" ? "bg-warn" : "bg-crit")}
                style={{ width: `${Math.max(2, Math.min(100, ci * 100))}%` }}
              />
              <span className="absolute top-[-3px] h-[14px] w-px bg-ink-3/50" style={{ left: "30%" }} />
              <span className="absolute top-[-3px] h-[14px] w-px bg-ink-3/50" style={{ left: "50%" }} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-surface-2 p-2.5">
                <dt className="text-ink-3">{t("metric_max_cluster")}</dt>
                <dd className="mt-0.5 text-base font-bold text-ink tabular">{num(stats.max_cluster_size ?? 0)}</dd>
              </div>
              <div className="rounded-xl bg-surface-2 p-2.5">
                <dt className="text-ink-3">{t("metric_dispersion")}</dt>
                <dd className="mt-0.5 text-base font-bold text-ink tabular">{num(stats.dispersion || 0, 2)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
              {lastHuddle ? (
                <>
                  {t("thermal_last_event")}: <span className="font-semibold text-ink-2">{timeAgo(lastHuddle.timestamp, language)}</span>
                </>
              ) : (
                t("thermal_hint")
              )}
            </p>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function Row({ icon: Icon, label, children }: { icon: typeof Camera; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 text-xs">
      <span className="flex items-center gap-2 text-ink-2">
        <Icon className="h-3.5 w-3.5 text-ink-3" />
        {label}
      </span>
      <span className="text-right font-semibold text-ink">{children}</span>
    </div>
  );
}

/** Real values from /api/health + camera_fault events. */
export function SystemHealthCard() {
  const { t, language, num } = useLanguage();
  const { health, healthError, stats, events } = useLiveData();
  const camera = useCameraState();
  const lastFault = events.find((e) => e.alert_type === "camera_fault");

  const camLabel =
    camera === "live" ? t("status_live") : camera === "connecting" ? t("status_connecting") : camera === "stale" ? t("status_reconnecting") : t("status_offline");

  return (
    <Card className="h-full">
      <CardHeader icon={ServerCog} title={t("health_title")} />
      <CardBody className="pt-2">
        {healthError && !health ? (
          <div className="rounded-xl bg-crit-soft p-3 text-xs font-semibold text-crit">{t("health_unreachable")}</div>
        ) : !health ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-line">
            <Row icon={Camera} label={t("health_stream")}>
              <span className="inline-flex items-center gap-1.5">
                <LiveDot state={camera === "live" ? "live" : camera === "offline" ? "down" : "pending"} />
                {camLabel}
              </span>
            </Row>
            <Row icon={Cable} label={t("health_source")}>
              {health.source_type === "network_stream" ? t("health_network") : t("health_file")}
            </Row>
            <Row icon={Clock} label={t("health_frame_age")}>
              <span className={cn("tabular", health.last_frame_age_s > 5 && "text-warn")}>
                {health.last_frame_age_s >= 999 ? "—" : `${num(health.last_frame_age_s, 1)}${t("seconds_short")} ${t("health_ago")}`}
              </span>
            </Row>
            <Row icon={Gauge} label={t("health_pipeline")}>
              <span className="tabular">{num(stats.fps || health.pipeline_fps, 1)} fps</span>
            </Row>
            <Row icon={Database} label={t("health_db")}>
              <span className={health.db_status === "ok" ? "text-ok" : "text-crit"}>
                {health.db_status === "ok" ? t("health_ok") : health.db_status}
              </span>
            </Row>
            <Row icon={Camera} label={t("health_camera_fault")}>
              <span className={cn("font-medium", lastFault ? "text-warn" : "text-ink-3")}>
                {lastFault ? timeAgo(lastFault.timestamp, language) : t("health_no_faults")}
              </span>
            </Row>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
