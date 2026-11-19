"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList } from "recharts";
import { BarChart3, Info } from "lucide-react";
import { AlertEvent, AnimalTrack, fetchAnimals, fetchEvents } from "@/lib/api";
import { useLanguage } from "@/lib/LanguageContext";
import { ruleKey, cn } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { ActivityHealthChart, CountChart, Range, RangePicker } from "@/components/charts/TrendCharts";
import { ChartTooltip, useChartColors } from "@/components/charts/chartKit";
import { DensityGrid, ZoneOccupancy } from "@/components/monitoring/Spatial";
import { ThermalCard } from "@/components/monitoring/StatusCards";
import { AnimalTable } from "@/components/AnimalTable";
import { AnimalDetailDrawer } from "@/components/AnimalDetailDrawer";

type Tab = "trends" | "spatial" | "birds";
const SAMPLE = 200;

/** Anomaly frequency by rule over the most recent events (real data, sample size stated). */
function AnomalyFrequency() {
  const { t, num } = useLanguage();
  const c = useChartColors();
  const [events, setEvents] = useState<AlertEvent[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchEvents({ limit: SAMPLE })
      .then(setEvents)
      .catch(() => setError(true));
  }, []);

  const data = useMemo(() => {
    if (!events) return [];
    const by: Record<string, number> = {};
    events.forEach((e) => (by[e.alert_type] = (by[e.alert_type] || 0) + 1));
    return Object.entries(by)
      .map(([type, count]) => ({ type, label: t(ruleKey(type), type), count }))
      .sort((a, b) => b.count - a.count);
  }, [events, t]);

  return (
    <Card>
      <CardHeader
        icon={BarChart3}
        title={t("report_breakdown")}
        subtitle={events ? `${t("alerts_showing")} ${num(events.length)} / ${num(SAMPLE)}` : undefined}
      />
      <CardBody>
        {error ? (
          <EmptyState title={t("chart_error")} tone="error" />
        ) : !events ? (
          <Skeleton className="h-56 w-full" />
        ) : data.length === 0 ? (
          <EmptyState title={t("alerts_feed_empty")} tone="ok" />
        ) : (
          <div style={{ height: Math.max(160, data.length * 34 + 20) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }} barCategoryGap={6}>
                <CartesianGrid horizontal={false} stroke={c.grid} />
                <XAxis type="number" allowDecimals={false} tickFormatter={(v) => num(v)} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="label" width={200} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: c.grid, opacity: 0.5 }} />
                <Bar dataKey="count" name={t("report_anomalies")} fill={c.series1} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  <LabelList dataKey="count" position="right" fill={c.ink} fontSize={11} fontWeight={700} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function BirdsTab() {
  const { t, num } = useLanguage();
  const [animals, setAnimals] = useState<AnimalTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetchAnimals()
        .then((a) => !cancelled && setAnimals(a))
        .catch(() => {})
        .finally(() => !cancelled && setLoading(false));
    load();
    // Skip polls while the app is backgrounded (battery + mobile data).
    const iv = setInterval(() => document.visibilityState === "visible" && load(), 3000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-xl border border-info/20 bg-info-soft px-4 py-3 text-xs leading-relaxed text-ink-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
        <span>{t("birds_gate_note")}</span>
      </div>
      <AnimalTable animals={animals} loading={loading} onSelectAnimal={setSelected} />
      <AnimalDetailDrawer animalId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function AnalyticsInner() {
  const { t, num } = useLanguage();
  const router = useRouter();
  const params = useSearchParams();
  const tabParam = params.get("tab");
  const tab: Tab = tabParam === "spatial" || tabParam === "birds" ? tabParam : "trends";
  const [range, setRange] = useState<Range>("24h");

  const tabs: { id: Tab; label: string }[] = [
    { id: "trends", label: t("tab_trends") },
    { id: "spatial", label: t("tab_spatial") },
    { id: "birds", label: t("tab_birds") },
  ];

  return (
    <div>
      <PageHeader title={t("page_analytics_title")} subtitle={t("page_analytics_sub")} actions={tab === "trends" ? <RangePicker value={range} onChange={setRange} /> : undefined} />

      <div role="tablist" aria-label={t("page_analytics_title")} className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            role="tab"
            aria-selected={tab === tb.id}
            onClick={() => router.replace(tb.id === "trends" ? "/analytics" : `/analytics?tab=${tb.id}`, { scroll: false })}
            className={cn(
              "relative -mb-px whitespace-nowrap border-b-2 px-3.5 pb-2.5 pt-1 text-sm font-semibold transition-colors",
              tab === tb.id ? "border-brand text-ink" : "border-transparent text-ink-3 hover:text-ink"
            )}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "trends" && (
        <div className="space-y-4 sm:space-y-5 animate-fade-in">
          <ActivityHealthChart range={range} onRangeChange={setRange} height={300} hideRange />
          <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-2">
            <CountChart range={range} height={260} />
            <AnomalyFrequency />
          </div>
        </div>
      )}

      {tab === "spatial" && (
        <div className="grid grid-cols-1 gap-4 sm:gap-5 animate-fade-in lg:grid-cols-12">
          <div className="lg:col-span-8">
            <DensityGrid />
          </div>
          <div className="space-y-4 self-start sm:space-y-5 lg:col-span-4">
            <ZoneOccupancy />
            <ThermalCard />
          </div>
        </div>
      )}

      {tab === "birds" && <BirdsTab />}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AnalyticsInner />
    </Suspense>
  );
}
