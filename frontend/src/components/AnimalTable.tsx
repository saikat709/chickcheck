"use client";

import React, { useState } from "react";
import { ChevronRight, Bird } from "lucide-react";
import { AnimalTrack } from "@/lib/api";
import { useLanguage } from "@/lib/LanguageContext";
import { Card, CardHeader } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Controls";
import { StatusPill, LiveDot } from "@/components/ui/Badges";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { cn, normalizeStatus } from "@/lib/format";

interface AnimalTableProps {
  animals: AnimalTrack[];
  loading?: boolean;
  onSelectAnimal: (id: number) => void;
}

export function AnimalTable({ animals, loading, onSelectAnimal }: AnimalTableProps) {
  const { t, num } = useLanguage();
  const [filter, setFilter] = useState<"all" | "active" | "flagged">("all");

  const filtered = animals.filter((a) => {
    if (filter === "active") return a.active;
    if (filter === "flagged") return a.status === "alert" || a.status === "watch";
    return true;
  });

  const bar = (s: string) => ({ alert: "bg-crit", watch: "bg-warn", healthy: "bg-ok" }[normalizeStatus(s)]);

  return (
    <Card>
      <CardHeader
        className="[&>div:last-child]:w-full sm:[&>div:last-child]:w-auto [&>div:last-child]:overflow-x-auto"
        icon={Bird}
        title={t("table_title")}
        subtitle={t("table_sub")}
        actions={
          <Segmented
            value={filter}
            onChange={setFilter}
            ariaLabel="Filter"
            options={[
              { value: "all", label: `${t("table_filter_all")} · ${num(animals.length)}` },
              { value: "active", label: t("table_filter_active") },
              { value: "flagged", label: t("table_filter_flagged") },
            ]}
          />
        }
      />

      <div className="mt-4">
        {loading && animals.length === 0 ? (
          <div className="space-y-2 px-5 pb-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Bird} title={t("table_empty")} className="border-t border-line" />
        ) : (
          <>
          {/* Phones: one card per bird — no sideways scrolling */}
          <ul className="divide-y divide-line border-t border-line md:hidden">
            {filtered.map((a) => (
              <li key={a.animal_id}>
                <button
                  onClick={() => onSelectAnimal(a.animal_id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-surface-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-ink tabular">#{a.animal_id}</span>
                      <StatusPill status={a.status} />
                      <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold", a.active ? "text-ok" : "text-ink-3")}>
                        {a.active ? <LiveDot state="live" /> : <span className="h-2 w-2 rounded-full bg-line-strong" />}
                        {a.active ? t("table_in_view") : t("table_lost")}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                        <div className={cn("h-full rounded-full", bar(a.status))} style={{ width: `${Math.max(4, a.health_score)}%` }} />
                      </div>
                      <span className="w-8 text-right text-xs font-semibold text-ink tabular">{num(a.health_score)}</span>
                    </div>
                    <div className="mt-1.5 flex gap-4 text-[11px] text-ink-3 tabular">
                      <span>
                        {t("table_col_speed")}: {num(a.last_speed_norm, 2)} bl/s
                      </span>
                      <span>
                        {t("table_col_idle")}: {num(a.total_idle_seconds)}
                        {t("seconds_short")}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />
                </button>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-y border-line bg-surface-2/70 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                <tr>
                  <th className="px-5 py-2.5">{t("table_col_id")}</th>
                  <th className="px-3 py-2.5">{t("table_col_species")}</th>
                  <th className="px-3 py-2.5">{t("table_col_status")}</th>
                  <th className="px-3 py-2.5">{t("table_col_health")}</th>
                  <th className="px-3 py-2.5 text-right">{t("table_col_speed")}</th>
                  <th className="px-3 py-2.5 text-right">{t("table_col_idle")}</th>
                  <th className="px-3 py-2.5">{t("table_col_visible")}</th>
                  <th className="px-5 py-2.5" aria-label="Open" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((a) => (
                  <tr
                    key={a.animal_id}
                    onClick={() => onSelectAnimal(a.animal_id)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelectAnimal(a.animal_id)}
                    tabIndex={0}
                    className="cursor-pointer transition-colors hover:bg-surface-2/60 focus:bg-surface-2/60 focus:outline-none"
                  >
                    <td className="px-5 py-3 font-bold text-ink tabular">#{a.animal_id}</td>
                    <td className="px-3 py-3 capitalize text-ink-2">{a.species || "chicken"}</td>
                    <td className="px-3 py-3">
                      <StatusPill status={a.status} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 font-semibold text-ink tabular">{num(a.health_score)}</span>
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-3">
                          <div className={cn("h-full rounded-full", bar(a.status))} style={{ width: `${Math.max(4, a.health_score)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-ink-2 tabular">{num(a.last_speed_norm, 2)} bl/s</td>
                    <td className="px-3 py-3 text-right text-ink-2 tabular">{num(a.total_idle_seconds)}{t("seconds_short")}</td>
                    <td className="px-3 py-3">
                      <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", a.active ? "text-ok" : "text-ink-3")}>
                        {a.active ? <LiveDot state="live" /> : <span className="h-2 w-2 rounded-full bg-line-strong" />}
                        {a.active ? t("table_in_view") : t("table_lost")}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-ink-3">
                      <ChevronRight className="ml-auto h-4 w-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </Card>
  );
}
