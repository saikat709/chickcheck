"use client";

import React, { useEffect, useState } from "react";
import { Grid3x3, MapPinned, Droplets, Wheat, BedDouble, Ban, Square } from "lucide-react";
import { fetchHeatmapGrid } from "@/lib/api";
import { useLanguage } from "@/lib/LanguageContext";
import { useDataUnavailable, useLiveData } from "@/lib/LiveDataContext";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState, Skeleton } from "@/components/ui/States";
import type { TranslationKey } from "@/lib/translations";

const ZONE_META: Record<string, { key: TranslationKey; icon: typeof Wheat }> = {
  feeder: { key: "zone_feeder", icon: Wheat },
  drinker: { key: "zone_drinker", icon: Droplets },
  resting: { key: "zone_resting", icon: BedDouble },
  exclusion: { key: "zone_exclusion", icon: Ban },
};

/** Zone occupancy: one hue (magnitude), values labelled directly. */
export function ZoneOccupancy({ embedded = false }: { embedded?: boolean }) {
  const { t, num } = useLanguage();
  const { stats, hasStats } = useLiveData();
  const unavailable = useDataUnavailable();
  const zones = stats.zone_occupancy || {};
  const order = ["feeder", "drinker", "resting", "exclusion"];
  const rank = (z: string) => (order.indexOf(z) === -1 ? order.length : order.indexOf(z));
  const entries = Object.entries(zones).sort(([a], [b]) => rank(a) - rank(b));

  const body = unavailable ? (
    <EmptyState icon={MapPinned} tone="error" title={t("health_unreachable")} className="py-6" />
  ) : !hasStats ? (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  ) : entries.length === 0 ? (
    <EmptyState icon={MapPinned} title={t("zones_empty")} className="py-6" />
  ) : (
    <ul className="space-y-3.5">
      {entries.map(([zone, pct]) => {
        const meta = ZONE_META[zone] || { key: zone as TranslationKey, icon: Square };
        const Icon = meta.icon;
        const v = Math.max(0, Math.min(100, Number(pct) || 0));
        return (
          <li key={zone}>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-ink-2">
                <Icon className="h-3.5 w-3.5 text-earth" />
                {t(meta.key, zone)}
              </span>
              <span className="font-bold text-ink tabular">{num(v, 1)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-brand transition-all duration-700" style={{ width: `${Math.max(v, 1)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );

  if (embedded) return body;
  return (
    <Card className="h-full">
      <CardHeader icon={MapPinned} title={t("zones_title")} subtitle={t("zones_sub")} />
      <CardBody>{body}</CardBody>
    </Card>
  );
}

/** 16×16 rolling density grid — sequential single-hue ramp (was half-rendered + status colours). */
export function DensityGrid() {
  const { t, num } = useLanguage();
  const [grid, setGrid] = useState<number[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const d = await fetchHeatmapGrid();
        if (!cancelled) {
          setGrid(d.grid || []);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    // Skip polls while the app is backgrounded (battery + mobile data).
    const iv = setInterval(() => document.visibilityState === "visible" && load(), 4000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  const max = Math.max(0.0001, ...grid.flat());
  const hasData = grid.length > 0 && grid.flat().some((v) => v > 0);

  return (
    <Card className="h-full">
      <CardHeader icon={Grid3x3} title={t("density_title")} subtitle={t("density_sub")} />
      <CardBody>
        {loading && grid.length === 0 ? (
          <Skeleton className="aspect-video w-full" />
        ) : !hasData ? (
          <div className="grid aspect-video place-items-center rounded-xl bg-surface-2">
            <EmptyState icon={Grid3x3} title={error ? t("chart_error") : t("density_empty")} tone={error ? "error" : "neutral"} />
          </div>
        ) : (
          <div
            className="grid aspect-video w-full gap-[2px] overflow-hidden rounded-xl bg-surface p-[2px] ring-1 ring-line"
            style={{ gridTemplateColumns: `repeat(${grid[0].length}, 1fr)`, gridTemplateRows: `repeat(${grid.length}, 1fr)` }}
            role="img"
            aria-label={t("density_title")}
          >
            {grid.flatMap((row, r) =>
              row.map((val, c) => {
                const n = val / max;
                return (
                  <div
                    key={`${r}-${c}`}
                    className="rounded-[3px] transition-colors duration-500 hover:ring-2 hover:ring-ink/40"
                    style={{ backgroundColor: `rgb(var(--brand) / ${(0.05 + n * 0.9).toFixed(3)})` }}
                    title={`[${num(r + 1)}, ${num(c + 1)}] · ${num(val * 100)}%`}
                  />
                );
              })
            )}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2 text-[11px] text-ink-3">
          <span>{t("density_low")}</span>
          <span className="h-2 flex-1 max-w-[160px] rounded-full" style={{ background: "linear-gradient(90deg, rgb(var(--brand) / 0.06), rgb(var(--brand) / 0.95))" }} />
          <span>{t("density_high")}</span>
        </div>
      </CardBody>
    </Card>
  );
}
