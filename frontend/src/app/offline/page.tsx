"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { WifiOff, RefreshCw, Home, Clock } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { usePwa } from "@/lib/PwaContext";
import type { LiveStats } from "@/lib/api";
import { StatusPill } from "@/components/ui/Badges";
import { Card } from "@/components/ui/Card";
import { activityValue, countDisplay } from "@/lib/format";

/**
 * Offline fallback (precached by the service worker). Shows the last on-device
 * snapshot — clearly labelled as saved, never as live — and a retry action.
 */
export default function OfflinePage() {
  const { t, num, language } = useLanguage();
  const { online } = usePwa();
  const [snap, setSnap] = useState<{ savedAt: number; stats: LiveStats } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("chickcheck_last_stats");
      if (raw) setSnap(JSON.parse(raw));
    } catch {}
  }, []);

  const savedTime = snap
    ? new Date(snap.savedAt).toLocaleString(language === "bn" ? "bn-BD" : "en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
    : "";
  const count = snap ? countDisplay(snap.stats) : null;

  return (
    <div className="mx-auto max-w-xl py-6 sm:py-12">
      <div className="text-center">
        <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-warn-soft text-warn">
          <WifiOff className="h-6 w-6" />
        </span>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">{online ? t("offline_page_title") : t("offline_title")}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-3">{t("offline_page_desc")}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button onClick={() => window.location.reload()} className="btn btn-primary">
            <RefreshCw className="h-4 w-4" />
            {t("retry_connection")}
          </button>
          <Link href="/" className="btn btn-secondary">
            <Home className="h-4 w-4" />
            {t("go_home")}
          </Link>
        </div>
      </div>

      <Card className="mt-8 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-ink">{t("offline_last_known")}</h2>
          {snap && <StatusPill status={snap.stats.status} />}
        </div>
        {snap && count ? (
          <>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-warn">
              <Clock className="h-3.5 w-3.5" />
              {t("offline_saved_at", undefined, { time: savedTime })}
            </p>
            {/* Deliberately muted: these are not live values */}
            <dl className="mt-4 grid grid-cols-3 gap-3 opacity-70 grayscale">
              <div className="rounded-xl bg-surface-2 p-3">
                <dt className="text-[11px] text-ink-3">{t("metric_tracked_count")}</dt>
                <dd className="mt-0.5 text-lg font-bold text-ink tabular">{num(Number(count.value))}</dd>
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <dt className="text-[11px] text-ink-3">{t("metric_flock_activity")}</dt>
                <dd className="mt-0.5 text-lg font-bold text-ink tabular">{num(activityValue(snap.stats))}</dd>
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <dt className="text-[11px] text-ink-3">{t("metric_flock_health")}</dt>
                <dd className="mt-0.5 text-lg font-bold text-ink tabular">{num(snap.stats.flock_health_score)}</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="mt-2 text-xs text-ink-3">{t("offline_none")}</p>
        )}
      </Card>
    </div>
  );
}
