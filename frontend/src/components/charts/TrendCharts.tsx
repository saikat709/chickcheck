"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, AlertOctagon, Bird, LineChart as LineIcon } from "lucide-react";
import { fetchHistory, HistoryPoint } from "@/lib/api";
import { useLanguage } from "@/lib/LanguageContext";
import { parseTs } from "@/lib/format";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Controls";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { ChartTooltip, LegendItem, useChartColors } from "./chartKit";

export type Range = "1h" | "24h" | "7d";

export function useHistory(range: Range) {
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      try {
        const res = await fetchHistory(range);
        if (!cancelled) {
          setPoints(res.points || []);
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
    const iv = setInterval(() => document.visibilityState === "visible" && load(), range === "1h" ? 10000 : 60000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [range]);

  return { points, loading, error };
}

function useFormatted(points: HistoryPoint[], range: Range, lang: "en" | "bn") {
  return useMemo(() => {
    const locale = lang === "bn" ? "bn-BD" : "en-GB";
    return points.map((p) => {
      const d = parseTs(p.timestamp);
      const time =
        range === "7d"
          ? d.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
          : d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
      return {
        time,
        activity: Math.round(p.activity_index * 10) / 10,
        health: Math.round(p.flock_health_score),
        count: p.count,
      };
    });
  }, [points, range, lang]);
}

export function RangePicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const { t, num } = useLanguage();
  return (
    <Segmented
      value={value}
      onChange={onChange}
      ariaLabel="Time range"
      options={[
        { value: "1h", label: t("chart_range_1h") },
        { value: "24h", label: t("chart_range_24h") },
        { value: "7d", label: t("chart_range_7d") },
      ]}
    />
  );
}

function ChartState({ loading, error, empty, height }: { loading: boolean; error: boolean; empty: boolean; height: number }) {
  const { t, num } = useLanguage();
  if (loading && empty) return <Skeleton className="w-full" />;
  if (error && empty)
    return <EmptyState icon={AlertOctagon} tone="error" title={t("chart_error")} className="py-0" />;
  return (
    <div style={{ height }} className="flex items-center justify-center">
      <EmptyState icon={LineIcon} title={t("chart_collecting")} description={t("chart_collecting_desc")} />
    </div>
  );
}

/** Accessible alternative to the SVG chart: last 24 samples as a real table. */
function ChartDataTable({ rows, cols }: { rows: Record<string, string | number>[]; cols: { key: string; label: string }[] }) {
  const { t, num } = useLanguage();
  if (rows.length === 0) return null;
  const last = rows.slice(-24).reverse();
  return (
    <details className="group mt-3 text-xs">
      <summary className="inline-flex min-h-[36px] cursor-pointer select-none items-center font-semibold text-brand marker:content-none">
        {t("chart_table")}
      </summary>
      <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-line">
        <table className="w-full text-left tabular">
          <thead className="sticky top-0 bg-surface-2 text-ink-3">
            <tr>
              <th className="px-3 py-2 font-semibold">{t("chart_time")}</th>
              {cols.map((c) => (
                <th key={c.key} className="px-3 py-2 text-right font-semibold">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-ink-2">
            {last.map((r, i) => (
              <tr key={i}>
                <td className="px-3 py-1.5">{r.time}</td>
                {cols.map((c) => (
                  <td key={c.key} className="px-3 py-1.5 text-right">{typeof r[c.key] === "number" ? num(r[c.key] as number, Number.isInteger(r[c.key]) ? 0 : 1) : r[c.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Activity + health: same 0–100 scale → one axis, two validated series. */
export function ActivityHealthChart({
  range,
  onRangeChange,
  height = 260,
  hideRange = false,
}: {
  range: Range;
  onRangeChange: (r: Range) => void;
  height?: number;
  /** When a page-level picker already drives the range. */
  hideRange?: boolean;
}) {
  const { t, language, num } = useLanguage();
  const c = useChartColors();
  const { points, loading, error } = useHistory(range);
  const data = useFormatted(points, range, language);

  return (
    <Card className="h-full">
      <CardHeader
        icon={Activity}
        title={t("chart_activity_title")}
        subtitle={t("chart_activity_sub")}
        actions={hideRange ? undefined : <RangePicker value={range} onChange={onRangeChange} />}
      />
      <CardBody>
        <div className="mb-3 flex flex-wrap gap-4">
          <LegendItem color={c.series1} label={t("chart_activity")} />
          <LegendItem color={c.series2} label={t("chart_health")} />
        </div>
        <div style={{ height }}>
          {data.length === 0 ? (
            <div className="h-full [&>.skeleton]:h-full">
              <ChartState loading={loading} error={error} empty height={height} />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="time" tickLine={false} axisLine={false} minTickGap={36} />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => num(v)} tickLine={false} axisLine={false} width={36} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: c.axis, strokeDasharray: "3 3" }} />
                <Line type="monotone" dataKey="activity" name={t("chart_activity")} stroke={c.series1} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: c.surface, strokeWidth: 2 }} isAnimationActive={false} />
                <Line type="monotone" dataKey="health" name={t("chart_health")} stroke={c.series2} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: c.surface, strokeWidth: 2 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <ChartDataTable rows={data} cols={[{ key: "activity", label: t("chart_activity") }, { key: "health", label: t("chart_health") }]} />
      </CardBody>
    </Card>
  );
}

/** Bird count gets its own chart — it is not on a 0–100 scale. */
export function CountChart({ range, height = 220 }: { range: Range; height?: number }) {
  const { t, language, num } = useLanguage();
  const c = useChartColors();
  const { points, loading, error } = useHistory(range);
  const data = useFormatted(points, range, language);

  return (
    <Card className="h-full">
      <CardHeader icon={Bird} title={t("chart_count_title")} subtitle={t("chart_count_sub")} />
      <CardBody>
        <div style={{ height }}>
          {data.length === 0 ? (
            <div className="h-full [&>.skeleton]:h-full">
              <ChartState loading={loading} error={error} empty height={height} />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {/* Line (not area) with a fitted domain: a 0-based fill would flatten the count drops that matter */}
              <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="time" tickLine={false} axisLine={false} minTickGap={36} />
                <YAxis allowDecimals={false} domain={["auto", "auto"]} tickFormatter={(v) => num(v)} tickLine={false} axisLine={false} width={40} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: c.axis, strokeDasharray: "3 3" }} />
                <Line type="monotone" dataKey="count" name={t("chart_count")} stroke={c.series1} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: c.surface, strokeWidth: 2 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <ChartDataTable rows={data} cols={[{ key: "count", label: t("chart_count") }]} />
      </CardBody>
    </Card>
  );
}
