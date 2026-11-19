"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Bird, Zap, BellRing, Camera, ScanEye, ArrowRight, Video, FileText, Bell, CheckCircle2, AlertOctagon, Clock } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useLiveData, useCameraState, useDataUnavailable } from "@/lib/LiveDataContext";
import { useLastReceivedLabel } from "@/components/pwa/PwaBanners";
import { activityValue, countDisplay, normalizeStatus, timeAgo, cn } from "@/lib/format";
import { StatusPill } from "@/components/ui/Badges";
import { StatTile } from "@/components/ui/StatTile";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { VideoStream, useOverlayPrefs } from "@/components/monitoring/VideoStream";
import dynamic from "next/dynamic";
import type { Range } from "@/components/charts/TrendCharts";
import { ZoneOccupancy } from "@/components/monitoring/Spatial";
import { ThermalCard, SystemHealthCard } from "@/components/monitoring/StatusCards";
import { AlertItem } from "@/components/alerts/AlertItem";

// Recharts (~100 KB) is split off the Overview's critical path; status & KPIs render first.
const ChartFallback = () => <Skeleton className="h-[330px] w-full rounded-2xl" />;
const ActivityHealthChart = dynamic(() => import("@/components/charts/TrendCharts").then((m) => m.ActivityHealthChart), {
  ssr: false,
  loading: ChartFallback,
});
const CountChart = dynamic(() => import("@/components/charts/TrendCharts").then((m) => m.CountChart), {
  ssr: false,
  loading: ChartFallback,
});

function HealthRing({ value }: { value: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <svg viewBox="0 0 84 84" className="h-[68px] w-[68px] -rotate-90 sm:h-[92px] sm:w-[92px]" aria-hidden>
      <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="7" />
      <circle
        cx="42"
        cy="42"
        r={r}
        fill="none"
        stroke="#9BDDB2"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - v / 100)}
        className="transition-[stroke-dashoffset] duration-700"
      />
    </svg>
  );
}

function OverviewHero() {
  const { t, language, num } = useLanguage();
  const { stats, hasStats, openAlerts, openAlertsCapped, isLive } = useLiveData();
  const lastTime = useLastReceivedLabel();
  const stale = hasStats && !isLive;
  const camera = useCameraState();
  const status = normalizeStatus(stats.status);
  const headline = status === "alert" ? t("hero_status_alert") : status === "watch" ? t("hero_status_watch") : t("hero_status_healthy");
  const health = Math.round(stats.flock_health_score ?? 100);

  return (
    <section className="relative overflow-hidden rounded-2xl bg-forest text-white shadow-raised">
      {/* Real commercial-shed footage, heavily overlaid so text stays AA-legible */}
      {/* 800px image for phones (~60 KB), 1600px from md up */}
      <div className="absolute inset-0 bg-[url(/images/shed-hero-800.jpg)] bg-cover bg-center md:bg-[url(/images/shed-hero.jpg)]" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0F2A1D] via-[#143524]/90 to-[#143524]/55" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0F2A1D]/70 to-transparent" aria-hidden />

      <div className="relative flex flex-col gap-4 p-4 min-[375px]:p-5 sm:gap-6 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#A9D5B6]">{t("hero_flock_status")}</span>
            {hasStats && <StatusPill status={stats.status} className="!ring-white/20" />}
            {stale && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-warn">
                <Clock className="h-3 w-3" />
                {t("stale_badge", undefined, { time: lastTime })}
              </span>
            )}
          </div>
          {hasStats ? (
            <h2 className="mt-2 text-xl font-extrabold leading-tight tracking-tight min-[375px]:text-2xl sm:text-[28px]">{headline}</h2>
          ) : camera === "offline" ? (
            <h2 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight text-[#FFD2CC] sm:text-[28px]">{t("health_unreachable")}</h2>
          ) : (
            <div className="mt-3 h-8 w-80 max-w-full animate-pulse rounded-lg bg-white/10" />
          )}
          <p className="mt-2 text-sm text-[#C9DCCD]">
            <span className="capitalize">
              {t("hero_species")}: {stats.species}
            </span>
            {stats.timestamp > 0 && (
              <>
                {" · "}
                {t("hero_updated")} {timeAgo(stats.timestamp, language)}
              </>
            )}
          </p>

          <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 sm:mt-5 sm:flex-wrap sm:overflow-visible">
            <Link
              href="/events?status=open"
              className={cn(
                "btn btn-sm",
                openAlerts > 0 ? "bg-white text-forest hover:bg-[#F1F7F2]" : "bg-white/10 text-white hover:bg-white/20"
              )}
            >
              <Bell className="h-3.5 w-3.5" />
              {openAlerts > 0 ? `${num(openAlerts)}${openAlertsCapped ? "+" : ""} ${t("hero_open_alerts")}` : t("qa_review_alerts")}
            </Link>
            <Link href="/live" className="btn btn-sm bg-white/10 text-white hover:bg-white/20">
              <Video className="h-3.5 w-3.5" />
              {t("open_live")}
            </Link>
            <Link href="/reports" className="btn btn-sm bg-white/10 text-white hover:bg-white/20">
              <FileText className="h-3.5 w-3.5" />
              {t("qa_today_report")}
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3 self-stretch rounded-2xl bg-white/[0.07] p-2.5 pr-4 ring-1 ring-white/10 backdrop-blur-sm sm:gap-4 sm:self-start sm:p-3 sm:pr-5 lg:self-auto">
          <div className="relative grid place-items-center">
            <HealthRing value={hasStats ? health : 0} />
            <span className="absolute text-xl font-extrabold tabular sm:text-2xl">{hasStats ? num(health) : "–"}</span>
          </div>
          <div>
            <div className="text-xs font-semibold text-[#C9DCCD]">{t("metric_flock_health")}</div>
            <div className="mt-0.5 text-[11px] text-[#9DBBA5]">{num(0)}–{num(100)} · {t("disclaimer_short")}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function KpiRow() {
  const { t, num } = useLanguage();
  const { stats, hasStats, openAlerts, openAlertsCapped, openAlertsKnown, isLive } = useLiveData();
  const stale = hasStats && !isLive;
  const camera = useCameraState();
  const unavailable = useDataUnavailable();
  const count = countDisplay(stats);
  const activity = activityValue(stats);
  const immobile = stats.immobile_candidates_count ?? 0;
  const na = (v: React.ReactNode) => (unavailable ? "–" : v);
  const loading = !hasStats && !unavailable;

  return (
    <div className="grid grid-cols-2 gap-2.5 min-[375px]:gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
      <StatTile
        stale={stale}
        loading={loading}
        label={t("metric_tracked_count")}
        icon={Bird}
        value={na(num(Number(count.value)))}
        suffix={!unavailable && count.uncertainty !== null ? `± ${num(count.uncertainty)}` : undefined}
        caption={unavailable ? t("health_unreachable") : `${num(stats.active_count)} ${t("metric_active_chicks")} · ${num(stats.idle_count)} ${t("metric_idle_chicks")}`}
        tone="ok"
      />
      <StatTile
        stale={stale}
        loading={loading}
        label={t("metric_flock_activity")}
        icon={Zap}
        value={na(num(activity))}
        unit={`/ ${num(100)}`}
        meter={unavailable ? undefined : activity}
        caption={t("metric_activity_desc")}
        tone="info"
      />
      <StatTile
        label={t("metric_active_alerts")}
        icon={BellRing}
        value={openAlertsKnown ? `${num(openAlerts)}${openAlertsCapped ? "+" : ""}` : "–"}
        caption={!openAlertsKnown ? t("health_unreachable") : openAlerts > 0 ? t("metric_alerts_some") : t("metric_alerts_none")}
        tone={!openAlertsKnown ? "neutral" : openAlerts > 0 ? "warn" : "ok"}
        href="/events?status=open"
      />
      <StatTile
        stale={stale}
        loading={loading}
        label={t("metric_immobile")}
        icon={ScanEye}
        value={na(num(immobile))}
        caption={t("rule_immobile_bird_candidate")}
        tone={immobile > 0 ? "warn" : "neutral"}
        href="/events?type=immobile_bird_candidate"
      />
      <StatTile
        label={t("metric_camera")}
        icon={Camera}
        value={
          <span className="text-xl">
            {camera === "live" ? t("status_live") : camera === "connecting" ? t("status_connecting") : camera === "stale" ? t("status_reconnecting") : t("status_offline")}
          </span>
        }
        caption={`${num(stats.fps, 1)} fps${stats.density_method ? " · " + stats.density_method.replace(/_/g, " ") : ""}`}
        tone={camera === "live" ? "ok" : camera === "offline" ? "crit" : "warn"}
        href="/live"
        className="col-span-2 md:col-span-1"
      />
    </div>
  );
}

function RecentAlerts() {
  const { t, num } = useLanguage();
  const { events, eventsLoaded, eventsError } = useLiveData();
  const recent = events.slice(0, 6);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        icon={BellRing}
        title={t("alerts_feed_title")}
        actions={
          <Link href="/events" className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
            {t("view_all")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />
      <div className="mt-3 flex-1 overflow-y-auto border-t border-line lg:max-h-[440px]">
        {!eventsLoaded ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : eventsError && recent.length === 0 ? (
          <EmptyState icon={AlertOctagon} tone="error" title={t("chart_error")} description={t("health_unreachable")} />
        ) : recent.length === 0 ? (
          <EmptyState icon={CheckCircle2} tone="ok" title={t("alerts_feed_empty")} />
        ) : (
          <div className="divide-y divide-line">
            {recent.map((e) => (
              <AlertItem key={e.event_id || e.id} event={e} variant="compact" />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

export default function OverviewPage() {
  const { t, num } = useLanguage();
  const { prefs, ready } = useOverlayPrefs();
  const [range, setRange] = useState<Range>("1h");

  return (
    <div className="space-y-4 sm:space-y-5">
      <h1 className="sr-only">{t("page_overview_title")}</h1>
      <OverviewHero />
      <KpiRow />

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
        <Card className="overflow-hidden lg:col-span-8">
          <CardHeader
            icon={Video}
            title={t("video_panel_title")}
            actions={
              <Link href="/live" className="btn btn-sm btn-secondary">
                {t("open_live")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="mt-4">
            <VideoStream prefs={prefs} ready={ready} compact />
          </div>
        </Card>
        <div className="lg:col-span-4">
          <RecentAlerts />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-12">
        <div className="md:col-span-2 xl:col-span-6">
          <ActivityHealthChart range={range} onRangeChange={setRange} height={230} />
        </div>
        <div className="xl:col-span-3">
          <ThermalCard />
        </div>
        <div className="xl:col-span-3">
          <ZoneOccupancy />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <SystemHealthCard />
        </div>
        <div className="lg:col-span-8">
          <CountChart range={range} height={232} />
        </div>
      </div>
    </div>
  );
}
