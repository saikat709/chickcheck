"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Calendar, Bird, Zap, HeartPulse, BellRing, FileText, BarChart3, ListOrdered, Clock3, AlertOctagon } from "lucide-react";
import { DailyReport, fetchDailyReport } from "@/lib/api";
import { useLanguage } from "@/lib/LanguageContext";
import { Language } from "@/lib/translations";
import { ruleKey, formatTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Controls";
import { StatTile } from "@/components/ui/StatTile";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { ChartTooltip, useChartColors } from "@/components/charts/chartKit";

type Report = DailyReport & { summary_text?: string };

export default function ReportsPage() {
  const { language, t, num } = useLanguage();
  const c = useChartColors();
  // Report dates are UTC days on the backend
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [reportLang, setReportLang] = useState<Language>(language);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => setReportLang(language), [language]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchDailyReport(date, reportLang)
      .then((r) => !cancelled && setReport(r))
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setReport(null);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [date, reportLang]);

  const hourly = useMemo(
    () =>
      report
        ? Object.entries(report.hourly_activity_trend)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([hour, v]) => ({ hour: hour.slice(0, 2), activity: v ?? null }))
        : [],
    [report]
  );
  const hasHourly = hourly.some((h) => h.activity !== null);

  const breakdown = report ? Object.entries(report.alerts_summary.by_type).sort((a, b) => b[1] - a[1]) : [];
  const maxType = Math.max(1, ...breakdown.map(([, n]) => n));
  const pdfUrl = `/api/reports/daily?date=${date}&format=pdf&lang=${reportLang}`;

  return (
    <div>
      <PageHeader
        title={t("page_reports_title")}
        subtitle={t("page_reports_sub")}
        actions={
          <>
            <label className="flex h-9 items-center gap-2 rounded-xl border border-line bg-surface px-3 shadow-card focus-within:border-brand">
              <Calendar className="h-4 w-4 text-ink-3" />
              <input
                type="date"
                value={date}
                max={new Date().toISOString().split("T")[0]}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="bg-transparent text-sm font-semibold text-ink outline-none"
                aria-label="Report date"
              />
            </label>
            <Segmented<Language>
              value={reportLang}
              onChange={setReportLang}
              ariaLabel={t("report_lang")}
              options={[
                { value: "en", label: "EN" },
                { value: "bn", label: "বাংলা" },
              ]}
            />
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              <Download className="h-4 w-4" />
              {t("report_generate_btn")}
            </a>
          </>
        }
      />

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[118px]" />
            ))}
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      ) : error ? (
        <Card>
          <EmptyState icon={AlertOctagon} tone="error" title={t("report_error")} />
        </Card>
      ) : !report ? (
        <Card>
          <EmptyState icon={FileText} title={t("report_empty")} />
        </Card>
      ) : (
        <div className="space-y-4 sm:space-y-5 animate-fade-in">
          {report.summary_text && (
            <section className="relative overflow-hidden rounded-2xl border border-brand/20 bg-brand-soft p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-bold text-brand-strong">
                  <FileText className="h-4 w-4" />
                  {t("report_executive_summary")}
                </h2>
                {report.generated_at && (
                  <span className="text-[11px] text-ink-3">
                    {t("report_generated")}: {formatTime(report.generated_at, language, true)}
                  </span>
                )}
              </div>
              <p className="mt-2 max-w-4xl text-[15px] leading-relaxed text-ink" lang={reportLang}>
                {report.summary_text}
              </p>
            </section>
          )}

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatTile
              label={t("report_avg_count")}
              icon={Bird}
              value={num(report.flock_summary.avg_count, 1)}
              caption={t("report_peak_min", undefined, { max: report.flock_summary.max_count, min: report.flock_summary.min_count })}
              tone="ok"
            />
            <StatTile label={t("report_mean_activity")} icon={Zap} value={num(report.flock_summary.avg_activity_index, 1)} unit={`/ ${num(100)}`} meter={report.flock_summary.avg_activity_index} tone="info" />
            <StatTile label={t("report_health")} icon={HeartPulse} value={num(report.flock_summary.avg_health_score, 1)} unit={`/ ${num(100)}`} meter={report.flock_summary.avg_health_score} tone="ok" />
            <StatTile
              label={t("report_anomalies")}
              icon={BellRing}
              value={num(report.alerts_summary.total_alerts)}
              caption={`${t("report_critical")}: ${num(report.alerts_summary.by_severity.critical || 0)}`}
              tone={(report.alerts_summary.by_severity.critical || 0) > 0 ? "crit" : report.alerts_summary.total_alerts > 0 ? "warn" : "ok"}
            />
          </div>

          <Card>
            <CardHeader icon={Clock3} title={t("report_hourly")} subtitle={t("report_hourly_sub")} />
            <CardBody>
              {!hasHourly ? (
                <EmptyState title={t("report_no_hourly")} />
              ) : (
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap={2}>
                      <CartesianGrid vertical={false} stroke={c.grid} />
                      <XAxis dataKey="hour" tickFormatter={(h) => num(Number(h)).padStart(2, num(0))} tickLine={false} axisLine={false} interval={1} />
                      <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => num(v)} tickLine={false} axisLine={false} width={36} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: c.grid, opacity: 0.5 }} />
                      <Bar dataKey="activity" name={t("chart_activity")} fill={c.series1} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader icon={BarChart3} title={t("report_breakdown")} />
              <CardBody>
                {breakdown.length === 0 ? (
                  <EmptyState title={t("report_none_logged")} tone="ok" />
                ) : (
                  <ul className="space-y-3">
                    {breakdown.map(([type, n]) => (
                      <li key={type}>
                        <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                          <span className="truncate font-medium text-ink-2">{t(ruleKey(type), type.replace(/_/g, " "))}</span>
                          <span className="font-bold text-ink tabular">{num(n)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                          <div className="h-full rounded-full bg-brand" style={{ width: `${(n / maxType) * 100}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader icon={ListOrdered} title={t("report_flagged")} />
              <CardBody>
                {report.alerts_summary.top_flagged_animals.length === 0 ? (
                  <EmptyState title={t("report_none_flagged")} tone="ok" />
                ) : (
                  <ul className="divide-y divide-line">
                    {report.alerts_summary.top_flagged_animals.map((item) => (
                      <li key={item.animal_id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ink tabular">#{item.animal_id}</span>
                          <span className="text-xs capitalize text-ink-3">{report.species}</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-semibold text-ink-2 tabular">
                            {num(item.flag_count)} {t("report_alerts")}
                          </span>
                          <span
                            className={
                              item.flag_count >= 3
                                ? "rounded-md bg-crit-soft px-2 py-1 text-[11px] font-semibold text-crit"
                                : "rounded-md bg-warn-soft px-2 py-1 text-[11px] font-semibold text-warn"
                            }
                          >
                            {item.flag_count >= 3 ? t("report_inspect") : t("report_monitor")}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
