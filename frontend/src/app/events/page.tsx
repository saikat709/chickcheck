"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw, Search, X, SearchX, AlertOctagon, AlertTriangle, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { AlertEvent, fetchEvents } from "@/lib/api";
import { useLanguage } from "@/lib/LanguageContext";
import { useLiveData } from "@/lib/LiveDataContext";
import { ALERT_TYPES, ruleKey, cn } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Controls";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { AlertItem } from "@/components/alerts/AlertItem";

type StatusFilter = "open" | "acked" | "all";
const LIMIT = 20;

function useOpenBySeverity(refreshKey: number) {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      (["critical", "warning", "info"] as const).map((s) =>
        fetchEvents({ severity: s, acknowledged: false, limit: 200 })
          .then((r) => [s, r.length] as const)
          .catch(() => [s, 0] as const)
      )
    ).then((rows) => !cancelled && setCounts(Object.fromEntries(rows)));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);
  return counts;
}

function EventsInner() {
  const { t, num } = useLanguage();
  const params = useSearchParams();
  const { events: liveEvents } = useLiveData();

  const [severity, setSeverity] = useState("");
  const [type, setType] = useState(params.get("type") || "");
  const [animal, setAnimal] = useState("");
  const [status, setStatus] = useState<StatusFilter>(params.get("status") === "open" ? "open" : "all");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sevKey, setSevKey] = useState(0);
  const sevCounts = useOpenBySeverity(refreshKey + sevKey + liveEvents.length);

  // Follow deep links (e.g. the bell → /events?status=open) even when already on this page
  useEffect(() => {
    if (params.get("status") === "open") setStatus("open");
    const ty = params.get("type");
    if (ty) setType(ty);
    setOffset(0);
  }, [params]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchEvents({
        severity: severity || undefined,
        alert_type: type || undefined,
        animal_id: animal ? parseInt(animal, 10) : undefined,
        acknowledged: status === "all" ? undefined : status === "acked",
        limit: LIMIT,
        offset,
      });
      setEvents(data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [severity, type, animal, status, offset]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const resetPage = () => setOffset(0);
  const hasFilters = Boolean(severity || type || animal || query || status !== "all");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => `${e.title} ${e.description} ${t(ruleKey(e.alert_type), "")}`.toLowerCase().includes(q));
  }, [events, query, t]);

  const patchLocal = (id: string, patch: Partial<AlertEvent>) => {
    setEvents((p) => p.map((e) => (e.event_id === id ? { ...e, ...patch } : e)));
    if (patch.acknowledged) setSevKey((k) => k + 1);
  };

  const sevCards = [
    { id: "critical", icon: AlertOctagon, label: t("alert_severity_critical"), cls: "text-crit bg-crit-soft" },
    { id: "warning", icon: AlertTriangle, label: t("alert_severity_warning"), cls: "text-warn bg-warn-soft" },
    { id: "info", icon: Info, label: t("alert_severity_info"), cls: "text-info bg-info-soft" },
  ];

  return (
    <div>
      <PageHeader
        title={t("page_events_title")}
        subtitle={t("page_events_sub")}
        actions={
          <button onClick={() => setRefreshKey((k) => k + 1)} className="btn btn-secondary">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            {t("refresh")}
          </button>
        }
      />

      {/* Open alerts by severity — click to filter */}
      <div className="mb-4 grid grid-cols-3 gap-3 sm:gap-4">
        {sevCards.map((s) => {
          const active = severity === s.id && status === "open";
          return (
            <button
              key={s.id}
              onClick={() => {
                if (active) {
                  setSeverity("");
                } else {
                  setSeverity(s.id);
                  setStatus("open");
                }
                resetPage();
              }}
              className={cn(
                "card flex items-center gap-3 p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-raised sm:p-4",
                active && "ring-2 ring-brand"
              )}
              aria-pressed={active}
            >
              <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", s.cls)}>
                <s.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-xl font-extrabold leading-none text-ink tabular">
                  {sevCounts ? `${num(sevCounts[s.id])}${sevCounts[s.id] >= 200 ? "+" : ""}` : "–"}
                </span>
                <span className="mt-1 block truncate text-[11px] font-medium text-ink-3">
                  {s.label} · {t("alerts_filter_open")}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        {/* Filter bar — one row above the list */}
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("alerts_search")}
              className="input !pl-9"
              aria-label={t("alerts_search")}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented<StatusFilter>
              value={status}
              onChange={(v) => {
                setStatus(v);
                resetPage();
              }}
              ariaLabel={t("alerts_filter_status")}
              options={[
                { value: "open", label: t("alerts_filter_open") },
                { value: "acked", label: t("alerts_filter_acked") },
                { value: "all", label: t("alerts_filter_all") },
              ]}
            />
            <select
              value={severity}
              onChange={(e) => {
                setSeverity(e.target.value);
                resetPage();
              }}
              className="input !h-9 !w-auto"
              aria-label={t("alerts_filter_all_sev")}
            >
              <option value="">{t("alerts_filter_all_sev")}</option>
              <option value="critical">{t("alert_severity_critical")}</option>
              <option value="warning">{t("alert_severity_warning")}</option>
              <option value="info">{t("alert_severity_info")}</option>
            </select>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                resetPage();
              }}
              className="input !h-9 !w-auto max-w-[220px]"
              aria-label={t("alerts_filter_all_types")}
            >
              <option value="">{t("alerts_filter_all_types")}</option>
              {ALERT_TYPES.map((at) => (
                <option key={at} value={at}>
                  {t(ruleKey(at), at)}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={animal}
              onChange={(e) => {
                setAnimal(e.target.value);
                resetPage();
              }}
              placeholder={t("alerts_filter_bird")}
              className="input !h-9 !w-28"
              aria-label={t("alerts_filter_bird")}
            />
            {hasFilters && (
              <button
                onClick={() => {
                  setSeverity("");
                  setType("");
                  setAnimal("");
                  setQuery("");
                  setStatus("all");
                  resetPage();
                }}
                className="btn btn-ghost btn-sm"
              >
                <X className="h-3.5 w-3.5" />
                {t("alerts_clear")}
              </button>
            )}
          </div>
        </div>

        {loading && events.length === 0 ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={AlertOctagon}
            tone="error"
            title={t("chart_error")}
            action={
              <button className="btn btn-secondary btn-sm" onClick={() => setRefreshKey((k) => k + 1)}>
                {t("retry")}
              </button>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState icon={SearchX} title={t("alerts_empty_title")} description={t("alerts_empty_desc")} />
        ) : (
          <div className={cn("divide-y divide-line transition-opacity", loading && "opacity-60")}>
            {visible.map((e) => (
              <AlertItem key={e.event_id || e.id} event={e} onChange={(patch) => patchLocal(e.event_id, patch)} />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-2/50 px-4 py-3 text-xs">
          <button onClick={() => setOffset(Math.max(0, offset - LIMIT))} disabled={offset === 0 || loading} className="btn btn-secondary btn-sm">
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("alerts_prev")}</span>
          </button>
          <span className="text-ink-3 tabular">
            {events.length > 0 ? `${t("alerts_showing")} ${num(offset + 1)}–${num(offset + events.length)}` : "—"}
            {query && ` · ${num(visible.length)} ${t("alerts_on_page")}`}
          </span>
          <button onClick={() => setOffset(offset + LIMIT)} disabled={events.length < LIMIT || loading} className="btn btn-secondary btn-sm">
            <span className="hidden sm:inline">{t("alerts_next")}</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </Card>
    </div>
  );
}

export default function EventsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <EventsInner />
    </Suspense>
  );
}
